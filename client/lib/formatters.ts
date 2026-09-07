export const formatCurrency = (value: number | string | null | undefined) => {
  const number = Number(value ?? 0);
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(number);
};

export const formatKg = (value: number | string | null | undefined) => {
  return `${Number(value ?? 0).toLocaleString('es-MX', {
    maximumFractionDigits: 2
  })} kg`;
};

/**
 * Una fecha para leer, con el dia que de verdad es.
 *
 * `new Date('2026-09-11')` NO da el 11 de septiembre: el estandar obliga a
 * leer una fecha suelta como medianoche UTC, que en Mexico son las 18:00 del
 * dia ANTERIOR. Un pedido para el viernes 11 salia en el panel como el jueves
 * 10 — y esa es la fecha con la que alguien prepara la mercancia.
 *
 * Por eso una fecha sin hora se arma pieza por pieza, que es la unica forma de
 * que el constructor la tome como local. Las marcas de tiempo completas si
 * traen su zona horaria y se leen tal cual.
 */
export const formatDate = (value?: string | null) => {
  if (!value) return 'Sin fecha';

  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const fecha = soloFecha
    ? new Date(Number(soloFecha[1]), Number(soloFecha[2]) - 1, Number(soloFecha[3]))
    : new Date(value);

  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(fecha);
};

export const formatDateTime = (value?: string | null) => {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
};
