/**
 * En que punto esta la captura de costos, y por tanto que se puede decir.
 *
 * Existe porque "¿puedo hablar de ganancia?" no es un si o un no: hay cuatro
 * situaciones distintas y cada una pide un mensaje distinto. Meter esa
 * decision en cada pantalla llevaria a que el Inicio y Reportes acabaran
 * diciendo cosas diferentes sobre los mismos numeros.
 *
 * La que se pasa por alto siempre es `ventas_anteriores`, y es la que mas
 * confunde al dueño: captura los costos, vuelve al panel y le sigue diciendo
 * "falta guardar cuanto te cuesta cada kilo". No falta nada — el costo se
 * congela en el renglon AL VENDER, asi que las ventas de antes no lo llevan y
 * nunca lo van a llevar. Ese matiz no se explica solo; hay que decirlo.
 */
export type EstadoCosto =
  /** Ningun producto tiene costo. No hay nada que calcular. */
  | { tipo: 'sin_capturar' }
  /** Ya hay costos, pero estas ventas son de antes de capturarlos. */
  | { tipo: 'ventas_anteriores' }
  /**
   * Parte de los kilos vendidos trae costo. La ganancia es parcial.
   *
   * `faltanProductos` dice DE QUE lado viene el hueco, y cambia por completo
   * el consejo: si hay productos sin costo, el dueño puede arreglarlo yendo a
   * capturarlos; si ya estan todos, el hueco son ventas anteriores a la
   * captura y no hay nada que hacer — mandarlo a "completar los costos" seria
   * mandarlo a una tarea que ya termino.
   */
  | { tipo: 'parcial'; cobertura: number; faltanProductos: boolean }
  /** Todo lo vendido trae costo. La ganancia es la de verdad. */
  | { tipo: 'completo' };

/**
 * @param cobertura Que parte (0 a 1) de los KILOS VENDIDOS trae costo en su
 *   renglon. Es el unico dato que decide si la ganancia se puede calcular.
 * @param productos El catalogo, para distinguir "no has capturado nada" de
 *   "ya capturaste, pero estas ventas son viejas".
 */
export const estadoDelCosto = (
  cobertura: number,
  productos: ReadonlyArray<{ costo_kg?: number | string | null }>
): EstadoCosto => {
  // Se admite un hueco de un 1%: el redondeo de los kilos no deberia disparar
  // una advertencia sobre datos que en la practica estan completos.
  if (cobertura >= 0.99) return { tipo: 'completo' };

  const conCosto = productos.filter((p) => Number(p.costo_kg ?? 0) > 0).length;

  if (cobertura > 0) {
    return {
      tipo: 'parcial',
      cobertura,
      faltanProductos: productos.length > 0 && conCosto < productos.length
    };
  }

  return conCosto > 0 ? { tipo: 'ventas_anteriores' } : { tipo: 'sin_capturar' };
};

/** Si con estos datos se puede enseñar una cifra de ganancia. */
export const hayGanancia = (estado: EstadoCosto): boolean =>
  estado.tipo === 'completo' || estado.tipo === 'parcial';

/** Lo minimo de un renglon de pedido para poder sacarle la ganancia. */
export type RenglonVendido = {
  kg?: number | string | null;
  subtotal?: number | string | null;
  costo_kg?: number | string | null;
};

export type ResumenGanancia = {
  /** Ingreso de los renglones QUE TRAEN COSTO. No es el ingreso del periodo. */
  ingresoConCosto: number;
  /** Costo de esos mismos renglones. */
  costo: number;
  ganancia: number;
  /** Fraccion (0 a 1) sobre `ingresoConCosto`, no sobre el ingreso total. */
  margen: number;
  kgConCosto: number;
  kgTotales: number;
  /** Fraccion (0 a 1) de los kilos vendidos que trae costo. */
  cobertura: number;
};

/**
 * La ganancia de un monton de renglones vendidos.
 *
 * Existe porque este calculo estaba escrito dos veces, y las dos versiones NO
 * daban lo mismo: el Inicio sumaba solo los renglones con costo, y Reportes
 * restaba el costo conocido del ingreso TOTAL. Con la mitad de los kilos sin
 * costo capturado, la misma venta de $2,000 salia con $500 de ganancia (50%)
 * en una pantalla y $1,500 (75%) en la otra. El dueño fija precios con ese
 * margen; el numero inflado es el que hace daño.
 *
 * Los renglones sin costo se ignoran enteros — ingreso incluido. Restar un
 * costo parcial de un ingreso completo no es "una aproximacion": es contar
 * esos kilos como ganancia pura. Cuanto abarca la cifra lo dice `cobertura`,
 * y de ahi sale el aviso de la pantalla.
 */
export const resumenGanancia = (
  renglones: Iterable<RenglonVendido>
): ResumenGanancia => {
  let ingresoConCosto = 0;
  let costo = 0;
  let kgConCosto = 0;
  let kgTotales = 0;

  for (const r of renglones) {
    const kg = Number(r.kg ?? 0);
    const costoKg = Number(r.costo_kg ?? 0);
    kgTotales += kg;
    if (!(costoKg > 0)) continue;
    kgConCosto += kg;
    ingresoConCosto += Number(r.subtotal ?? 0);
    costo += costoKg * kg;
  }

  return {
    ingresoConCosto,
    costo,
    ganancia: ingresoConCosto - costo,
    margen: ingresoConCosto > 0 ? (ingresoConCosto - costo) / ingresoConCosto : 0,
    kgConCosto,
    kgTotales,
    cobertura: kgTotales > 0 ? kgConCosto / kgTotales : 0
  };
};
