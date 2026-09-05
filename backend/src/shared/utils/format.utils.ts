import { toNumber } from './numbers.utils';

/**
 * Formato para los mensajes que le llegan al cliente por WhatsApp.
 *
 * Vive en el backend a proposito: el frontend tiene sus propios formatters,
 * pero un mensaje de WhatsApp se arma del lado del servidor y nunca pasa por
 * el navegador.
 */

export const formatCurrency = (value: number | string | null | undefined): string =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(toNumber(value));

export const formatKg = (value: number | string | null | undefined): string => {
  const n = toNumber(value);
  // Sin decimales cuando es entero: "20 kg" se lee mejor que "20.00 kg".
  const texto = Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, '');
  return `${texto} kg`;
};
