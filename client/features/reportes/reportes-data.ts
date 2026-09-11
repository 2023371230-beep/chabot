import { resumenGanancia, type RenglonVendido } from '@/client/lib/costos';
import type { InventarioResumen, Pedido } from '@/client/types/models';

/** Un renglon tal como llega en `pedido_detalles`. */
type PedidoDetalleLike = RenglonVendido & { productos?: { nombre?: string } | null };

export type Periodo =
  | 'hoy'
  | 'ayer'
  | 'semana'
  | 'mes'
  | 'mes_pasado'
  | 'trimestre'
  | 'todo'
  | 'personalizado';

/**
 * Los periodos, del mas corto al mas largo.
 *
 * Faltaban los cortos, que son los que de verdad se consultan a diario: al
 * cerrar el turno lo que se quiere saber es cuanto se vendio HOY, no en el mes.
 * Con solo mes / 90 dias / todo, para ver un dia suelto habia que sacar la
 * cuenta a mano.
 */
export const PERIODOS: { valor: Periodo; etiqueta: string; explica: string }[] = [
  { valor: 'hoy', etiqueta: 'Hoy', explica: 'Desde las 00:00 de hoy' },
  { valor: 'ayer', etiqueta: 'Ayer', explica: 'El dia completo de ayer' },
  { valor: 'semana', etiqueta: '7 dias', explica: 'Los 7 dias anteriores a hoy' },
  { valor: 'mes', etiqueta: 'Este mes', explica: 'Del dia 1 a hoy' },
  { valor: 'mes_pasado', etiqueta: 'Mes pasado', explica: 'El mes completo anterior' },
  { valor: 'trimestre', etiqueta: '90 dias', explica: 'Los 90 dias anteriores a hoy' },
  { valor: 'todo', etiqueta: 'Todo', explica: 'Desde que arranco el sistema' },
  { valor: 'personalizado', etiqueta: 'Elegir fechas', explica: 'Un rango cualquiera' }
];

/** Un rango elegido a mano, en formato `YYYY-MM-DD`. */
export type RangoManual = { desde: string; hasta: string };

/** Medianoche del dia de esa fecha, en hora local. */
const inicioDelDia = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Medianoche del dia SIGUIENTE: el limite abierto de un rango que lo incluye. */
const finDelDia = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

/**
 * Rango [desde, hasta) del periodo, y el rango anterior del mismo largo.
 *
 * El limite superior es ABIERTO a proposito. Con `<=` un pedido de las
 * 23:59:30 podria quedar dentro o fuera segun el milisegundo con el que se
 * compare; comparar contra la medianoche siguiente no tiene ese borde.
 */
export function rangos(periodo: Periodo, manual?: RangoManual) {
  const ahora = new Date();
  let desde: Date;
  let hasta = new Date(ahora);

  if (periodo === 'hoy') {
    desde = inicioDelDia(ahora);
  } else if (periodo === 'ayer') {
    const ayer = new Date(ahora);
    ayer.setDate(ayer.getDate() - 1);
    desde = inicioDelDia(ayer);
    hasta = inicioDelDia(ahora);
  } else if (periodo === 'semana') {
    desde = new Date(ahora);
    desde.setDate(desde.getDate() - 7);
  } else if (periodo === 'personalizado' && manual?.desde && manual?.hasta) {
    // Las fechas llegan como `YYYY-MM-DD`. Se parten a mano en vez de pasarlas
    // a `new Date()`: ese constructor las lee como UTC, y en Mexico eso
    // desplazaria el rango seis horas, metiendo o sacando los pedidos de la
    // noche del dia equivocado.
    const [a1, m1, d1] = manual.desde.split('-').map(Number);
    const [a2, m2, d2] = manual.hasta.split('-').map(Number);
    desde = inicioDelDia(new Date(a1, m1 - 1, d1));
    hasta = finDelDia(new Date(a2, m2 - 1, d2));
  } else if (periodo === 'mes') {
    desde = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  } else if (periodo === 'mes_pasado') {
    desde = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
    hasta = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  } else if (periodo === 'trimestre') {
    desde = new Date(ahora);
    desde.setDate(desde.getDate() - 90);
  } else {
    desde = new Date(0);
  }

  const largo = hasta.getTime() - desde.getTime();
  return {
    desde,
    hasta,
    // Periodo anterior del mismo largo, para poder comparar contra algo.
    previoDesde: new Date(desde.getTime() - largo),
    previoHasta: desde
  };
}

const enRango = (p: Pedido, desde: Date, hasta: Date) => {
  const f = new Date(p.created_at);
  return f >= desde && f < hasta;
};

/** Solo confirmados y entregados son dinero real: un pendiente aun no vendio. */
const vendidos = (pedidos: Pedido[]) =>
  pedidos.filter((p) => p.estado === 'confirmado' || p.estado === 'completado');

export type FilaProducto = {
  nombre: string;
  kg: number;
  ingreso: number;
  /** Lo que costo ese producto. 0 cuando no se ha capturado el costo. */
  costo: number;
};
export type FilaCliente = { nombre: string; telefono: string; pedidos: number; ingreso: number };

export function calcular(
  pedidos: Pedido[],
  inventario: InventarioResumen[],
  periodo: Periodo,
  manual?: RangoManual
) {
  const { desde, hasta, previoDesde, previoHasta } = rangos(periodo, manual);

  const delPeriodo = pedidos.filter((p) => enRango(p, desde, hasta));
  const delPrevio = pedidos.filter((p) => enRango(p, previoDesde, previoHasta));

  const v = vendidos(delPeriodo);
  const vPrev = vendidos(delPrevio);

  const suma = (lista: Pedido[], campo: 'total_precio' | 'total_kg') =>
    lista.reduce((a, p) => a + Number(p[campo] ?? 0), 0);

  const ingreso = suma(v, 'total_precio');
  const ingresoPrev = suma(vPrev, 'total_precio');
  const kg = suma(v, 'total_kg');
  const kgPrev = suma(vPrev, 'total_kg');

  // Producto, y de paso el costo de lo vendido.
  //
  // El costo sale del RENGLON (`costo_kg` congelado al vender), no del producto
  // actual: un cambio de costo hoy no debe reescribir la ganancia de un pedido
  // de hace tres meses.
  const porProducto = new Map<string, FilaProducto>();
  const renglones: PedidoDetalleLike[] = [];

  for (const pedido of v) {
    for (const d of pedido.pedido_detalles ?? []) {
      const nombre = d.productos?.nombre ?? 'Sin nombre';
      const f = porProducto.get(nombre) ?? { nombre, kg: 0, ingreso: 0, costo: 0 };
      const kgRenglon = Number(d.kg ?? 0);

      f.kg += kgRenglon;
      f.ingreso += Number(d.subtotal ?? 0);
      f.costo += Number(d.costo_kg ?? 0) * kgRenglon;
      porProducto.set(nombre, f);

      renglones.push(d);
    }
  }

  // La ganancia sale del mismo calculo que el panel de Inicio.
  //
  // Antes se hacia aqui a mano, y era `ingreso - costoTotal`: el ingreso
  // COMPLETO menos el costo de los pocos renglones que lo traian. Con la mitad
  // de los kilos sin costo, Reportes daba $1,500 (75% de margen) donde Inicio
  // daba $500 (50%) sobre las mismas ventas. Dos pantallas, dos verdades, y la
  // buena era la de Inicio.
  const g = resumenGanancia(renglones);
  const ganancia = g.ganancia;
  /** Que parte de los kilos vendidos tiene costo capturado. */
  const coberturaCosto = g.cobertura;

  // Cliente
  const porCliente = new Map<string, FilaCliente>();
  for (const pedido of v) {
    const tel = pedido.clientes?.telefono ?? pedido.cliente?.telefono ?? '—';
    const f = porCliente.get(tel) ?? {
      nombre: pedido.clientes?.nombre ?? pedido.cliente?.nombre ?? 'Cliente',
      telefono: tel,
      pedidos: 0,
      ingreso: 0
    };
    f.pedidos += 1;
    f.ingreso += Number(pedido.total_precio ?? 0);
    porCliente.set(tel, f);
  }

  const cancelados = delPeriodo.filter((p) => p.estado === 'cancelado').length;

  // Mermas: el inventario no guarda fecha por movimiento en el resumen, asi
  // que este bloque es historico total, no del periodo. Se etiqueta como tal
  // en la interfaz para no dar a entender lo que no es.
  const merma = inventario.reduce(
    (acc, i) => {
      const kgMerma = Number(i.total_mermas ?? 0);
      return {
        kg: acc.kg + kgMerma,
        dinero: acc.dinero + kgMerma * Number(i.precio_kg ?? 0)
      };
    },
    { kg: 0, dinero: 0 }
  );

  const variacion = (actual: number, previo: number) =>
    previo > 0 ? ((actual - previo) / previo) * 100 : null;

  return {
    desde,
    hasta,
    ingreso,
    kg,
    pedidos: v.length,
    ticket: v.length ? ingreso / v.length : 0,
    varIngreso: variacion(ingreso, ingresoPrev),
    varKg: variacion(kg, kgPrev),
    varPedidos: variacion(v.length, vPrev.length),
    productos: Array.from(porProducto.values()).sort((a, b) => b.ingreso - a.ingreso),
    clientes: Array.from(porCliente.values()).sort((a, b) => b.ingreso - a.ingreso),
    costo: g.costo,
    ganancia,
    /**
     * Ingreso de los renglones con costo — el unico contra el que la ganancia
     * cuadra. `ingreso` (el del periodo entero) NO le resta la ganancia: si
     * hay kilos sin costo capturado, son numeros de dos universos distintos.
     */
    ingresoConCosto: g.ingresoConCosto,
    /** Porcentaje (0 a 100) sobre `ingresoConCosto`. */
    margen: g.margen * 100,
    /**
     * Fraccion de los kilos vendidos con costo capturado.
     *
     * La pantalla lo usa para decidir si puede hablar de ganancia. Con
     * cobertura parcial el numero seria una mezcla de margen real e ingreso
     * puro, que es peor que no dar el dato.
     */
    coberturaCosto,
    cancelados,
    totalPeriodo: delPeriodo.length,
    // Se devuelven para que la pantalla no vuelva a filtrar lo mismo: antes
    // recorria el historico entero otra vez, construyendo un Date por pedido,
    // cada vez que se cambiaba de periodo.
    delPeriodo,
    merma,
    hayPrevio: vPrev.length > 0
  };
}
