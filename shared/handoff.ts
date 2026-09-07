/**
 * Los motivos por los que el bot deja un chat en manos de una persona.
 *
 * Modulo PURO a proposito: no importa Supabase ni nada del servidor, para que
 * puedan usarlo las dos orillas. El servidor lo necesita para el aviso por
 * WhatsApp al encargado; el navegador, para pintar el badge y el panel.
 *
 * Antes habia dos copias — `ETIQUETA` en el servidor y `MOTIVOS` en el hook —
 * y ya habian divergido: el mismo chat se anunciaba como "Pregunta por
 * entrega, direccion o pago" en el WhatsApp del encargado y como "Pregunta de
 * entrega o pago" en el dashboard. Dos textos para el mismo hecho.
 */

export type MotivoHandoff =
  | 'queja'
  | 'enojo'
  | 'negociacion'
  | 'logistica'
  | 'solicitud'
  | 'sin_stock'
  | 'modificacion'
  | 'sin_cuota'
  | 'no_entendido';

/** Como se nombra cada motivo a quien va a atender el chat. */
export const ETIQUETA_MOTIVO: Record<MotivoHandoff, string> = {
  queja: 'Reclamo de calidad',
  enojo: 'Cliente molesto',
  negociacion: 'Pide descuento o credito',
  logistica: 'Pregunta por entrega, direccion o pago',
  solicitud: 'Pidio hablar con una persona',
  sin_stock: 'Pedido mayor al stock disponible',
  modificacion: 'Quiere cambiar un pedido ya hecho',
  sin_cuota: 'Se agoto la cuota del asistente',
  no_entendido: 'El asistente no entendio despues de varios intentos'
};

/**
 * Los motivos que no pueden esperar.
 *
 * Se pintan en rojo y no en ambar. Un reclamo de calidad y un cliente enojado
 * se atienden antes que una pregunta de logistica, y el color es lo que
 * ordena la lista sin que haya que leerla entera.
 */
export const MOTIVOS_URGENTES = new Set<string>(['queja', 'enojo']);

/** Nombre legible de un motivo, tolerante a uno que el cliente no conozca. */
export const nombreMotivo = (motivo: string): string =>
  ETIQUETA_MOTIVO[motivo as MotivoHandoff] ?? 'Necesita atencion';

/** Recorta un texto largo dejando constancia de que se corto. */
export const recortar = (texto: string, maximo: number): string =>
  texto.length > maximo ? `${texto.slice(0, maximo)}...` : texto;
