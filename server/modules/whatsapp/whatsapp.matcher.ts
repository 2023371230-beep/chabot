import { normalizar } from '../../shared/utils/text.utils';
import type { Producto } from '../productos/productos.types';

/**
 * Traduce lo que escribe un cliente a datos que el sistema entiende.
 *
 * La IA devuelve `"pechuga"`, `"pechugas"` o `"pechuga de pollo"`. El catalogo
 * tiene `"Pechuga"` con un UUID. Este archivo cierra esa brecha, y hace lo
 * mismo con las fechas: `"el viernes"` -> `2026-09-11`.
 *
 * Deliberadamente NO usa IA para esto. Resolver un nombre contra un catalogo
 * cerrado es una busqueda, no una decision: con IA seria mas lento, mas caro y
 * podria inventar un producto que no existe.
 */

/** Palabras que el cliente dice pero no ayudan a identificar el producto. */
const RUIDO = new Set([
  'de',
  'del',
  'la',
  'el',
  'los',
  'las',
  'un',
  'una',
  'kilo',
  'kilos',
  'kg',
  'pollo',
  'carne',
  'porfavor',
  'porfa'
]);

const tokenizar = (texto: string): string[] =>
  normalizar(texto)
    .split(' ')
    // Singulariza de forma burda: "pechugas" -> "pechuga". Suficiente para un
    // catalogo de una docena de cortes.
    .map((t) => (t.length > 4 && t.endsWith('s') ? t.slice(0, -1) : t))
    .filter((t) => t.length > 2 && !RUIDO.has(t));

export type ResultadoMatch =
  | { encontrado: true; producto: Producto; confianza: 'exacta' | 'parcial' }
  | { encontrado: false; sugerencias: string[] };

/**
 * Busca un producto por lo que escribio el cliente.
 *
 * Tres pasadas, de mas estricta a mas laxa:
 *   1. nombre identico
 *   2. uno contiene al otro ("pechuga" dentro de "pechuga sin hueso")
 *   3. comparten alguna palabra significativa
 *
 * Si dos productos empatan en la pasada mas laxa se considera ambiguo y se
 * devuelve como no encontrado con sugerencias: es mejor preguntar que adivinar
 * y venderle al cliente algo que no pidio.
 */
export const buscarProducto = (
  textoCliente: string,
  catalogo: Producto[]
): ResultadoMatch => {
  const activos = catalogo.filter((p) => p.activo);
  const buscado = normalizar(textoCliente);
  const tokensBuscados = tokenizar(textoCliente);

  const sugerencias = activos.slice(0, 6).map((p) => p.nombre);

  if (!buscado) return { encontrado: false, sugerencias };

  // 1. Coincidencia exacta
  const exacto = activos.find((p) => normalizar(p.nombre) === buscado);
  if (exacto) return { encontrado: true, producto: exacto, confianza: 'exacta' };

  // 2. Uno contiene al otro
  const contenidos = activos.filter((p) => {
    const n = normalizar(p.nombre);
    return n.includes(buscado) || buscado.includes(n);
  });
  if (contenidos.length === 1) {
    return { encontrado: true, producto: contenidos[0], confianza: 'parcial' };
  }

  // 3. Comparten alguna palabra significativa
  if (tokensBuscados.length) {
    const porToken = activos.filter((p) => {
      const tokensProducto = tokenizar(p.nombre);
      return tokensProducto.some((t) => tokensBuscados.includes(t));
    });
    if (porToken.length === 1) {
      return { encontrado: true, producto: porToken[0], confianza: 'parcial' };
    }
    // Ambiguo: se sugieren solo los candidatos, no el catalogo entero.
    if (porToken.length > 1) {
      return { encontrado: false, sugerencias: porToken.map((p) => p.nombre) };
    }
  }

  return { encontrado: false, sugerencias };
};

/**
 * Comprueba que una fecha `YYYY-MM-DD` exista de verdad y no sea pasada.
 *
 * `new Date('2026-02-31')` no falla: JavaScript lo corre al 3 de marzo sin
 * avisar. Por eso se compara el resultado contra lo que se pidio.
 */
const validarFecha = (iso: string, hoy: Date): string | null => {
  const [a, m, d] = iso.split('-').map(Number);
  const fecha = new Date(a, m - 1, d);

  const existe =
    fecha.getFullYear() === a && fecha.getMonth() === m - 1 && fecha.getDate() === d;
  if (!existe) return null;

  // Se compara a medianoche: un pedido "para hoy" a las 3 de la tarde sigue
  // siendo valido.
  const inicioDeHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  if (fecha < inicioDeHoy) return null;

  // Mas de un año adelante es un error de tipeo en el año, no una entrega.
  const limite = new Date(inicioDeHoy);
  limite.setFullYear(limite.getFullYear() + 1);
  if (fecha > limite) return null;

  return iso;
};

const DIAS: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6
};

/**
 * Convierte la fecha que dijo el cliente a `YYYY-MM-DD`.
 *
 * Acepta "hoy", "manana", "pasado manana", un dia de la semana ("el viernes",
 * que siempre apunta al PROXIMO viernes) o una fecha ya formateada.
 * Si no entiende, devuelve null: mejor dejar el pedido sin fecha que agendar
 * una entrega para el dia equivocado.
 */
export const interpretarFecha = (texto: string | null | undefined): string | null => {
  if (!texto) return null;

  const t = normalizar(texto);
  const hoy = new Date();

  const aISO = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;

  // Una fecha ya formateada se acepta, pero solo si EXISTE y no es pasada.
  //
  // El modelo devuelve fechas inventadas con mas frecuencia de la que parece:
  // "31 de febrero", o el año en que fue entrenado. Sin este filtro, un
  // "para el 2024-03-15" quedaria agendado en el pasado y el pedido no
  // aparece en ninguna vista de proximas entregas — desaparece en silencio.
  const yaFormateada = /^\d{4}-\d{2}-\d{2}$/.exec(texto.trim());
  if (yaFormateada) return validarFecha(yaFormateada[0], hoy);

  if (t.includes('hoy')) return aISO(hoy);

  if (t.includes('pasado manana')) {
    const d = new Date(hoy);
    d.setDate(d.getDate() + 2);
    return aISO(d);
  }

  if (t.includes('manana')) {
    const d = new Date(hoy);
    d.setDate(d.getDate() + 1);
    return aISO(d);
  }

  for (const [nombre, indice] of Object.entries(DIAS)) {
    if (!t.includes(nombre)) continue;
    const d = new Date(hoy);
    // Siempre hacia adelante: si hoy es viernes y dicen "el viernes",
    // se entiende el de la proxima semana.
    let delta = (indice - d.getDay() + 7) % 7;
    if (delta === 0) delta = 7;
    d.setDate(d.getDate() + delta);
    return aISO(d);
  }

  return null;
};
