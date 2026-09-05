/**
 * La memoria corta de la conversacion.
 *
 * WhatsApp no tiene sesiones: cada mensaje llega solo, sin nada del anterior.
 * Sin memoria pasan cosas absurdas y todas cuestan dinero o clientes:
 *
 *   Bot: "Le sale en $1,900. Se lo aparto?"
 *   Cliente: "si porfa"
 *   Bot: "No alcance a identificar el pedido."      <- pregunto y no sabe oir
 *
 *   Bot: "Cuantos kilos de pechuga?"
 *   Cliente: "20"
 *   Bot: "No alcance a identificar el pedido."      <- lo mismo
 *
 *   Cliente: "20 kilos de pechuga"   (no le llega respuesta, reenvia)
 *   Cliente: "20 kilos de pechuga"
 *   -> dos pedidos, 40 kilos despachados             <- este cuesta pollo real
 *
 * Los cuatro recuerdos que guarda este archivo resuelven esos casos y ademas
 * evitan peticiones a la IA: una cotizacion confirmada se convierte en pedido
 * con los datos que YA teniamos, sin volver a preguntarle al modelo.
 *
 * Vive en memoria del proceso, no en la base. Es estado de minutos, y
 * escribirlo en Supabase costaria una consulta por mensaje para algo que se
 * tira solo. Si el backend se reinicia se pierde el hilo de las
 * conversaciones abiertas: el cliente tendria que repetir su pedido, que es
 * exactamente lo que pasaba antes de este archivo.
 */

export type Renglon = { producto_id: string; kg: number };

/** Cuanto vale cada recuerdo antes de volverse basura. */
const VIDA_COTIZACION = 30 * 60_000; // media hora: da tiempo a consultarlo
const VIDA_PREGUNTA_KG = 15 * 60_000;
const VIDA_RESPUESTA = 3 * 60_000; // ventana del "se me fue el mensaje"
const VIDA_PEDIDO = 10 * 60_000; // ventana del reenvio por desesperacion
const VIDA_CONVERSACION = 2 * 3_600_000;

/** Tope de conversaciones vivas, para que la memoria no crezca sin freno. */
const MAX_CONVERSACIONES = 5000;

type Conversacion = {
  tocada: number;
  cotizacion?: { renglones: Renglon[]; fechaEntrega?: string; en: number };
  preguntaKg?: { producto_id: string; nombre: string; en: number };
  ultimaRespuesta?: { texto: string; respuesta: string; en: number };
  ultimoPedido?: { firma: string; resumen: string; en: number };
};

const conversaciones = new Map<string, Conversacion>();

const vigente = (en: number, vida: number): boolean => Date.now() - en < vida;

const limpiar = (): void => {
  const ahora = Date.now();
  for (const [tel, c] of conversaciones) {
    if (ahora - c.tocada > VIDA_CONVERSACION) conversaciones.delete(tel);
  }
  // Si aun asi hay demasiadas, se tiran las mas viejas. Perder el hilo de una
  // conversacion abandonada es preferible a quedarse sin memoria.
  if (conversaciones.size > MAX_CONVERSACIONES) {
    const porEdad = [...conversaciones.entries()].sort((a, b) => a[1].tocada - b[1].tocada);
    for (const [tel] of porEdad.slice(0, conversaciones.size - MAX_CONVERSACIONES)) {
      conversaciones.delete(tel);
    }
  }
};

const abrir = (telefono: string): Conversacion => {
  limpiar();
  const existente = conversaciones.get(telefono);
  if (existente) {
    existente.tocada = Date.now();
    return existente;
  }
  const nueva: Conversacion = { tocada: Date.now() };
  conversaciones.set(telefono, nueva);
  return nueva;
};

// ── Cotizacion pendiente ────────────────────────────────────────────────

/** Se llama al mandar un "le sale en $X. Se lo aparto?". */
export const recordarCotizacion = (
  telefono: string,
  renglones: Renglon[],
  fechaEntrega?: string
): void => {
  abrir(telefono).cotizacion = { renglones, fechaEntrega, en: Date.now() };
};

/**
 * Devuelve la cotizacion pendiente y la borra.
 *
 * Se borra al leerla a proposito: un "si" solo puede convertir la cotizacion
 * en pedido UNA vez. Si el cliente manda "si" dos veces, el segundo ya no
 * encuentra nada y no crea un pedido duplicado.
 */
export const tomarCotizacion = (
  telefono: string
): { renglones: Renglon[]; fechaEntrega?: string } | null => {
  const c = conversaciones.get(telefono);
  if (!c?.cotizacion) return null;
  const { renglones, fechaEntrega, en } = c.cotizacion;
  delete c.cotizacion;
  if (!vigente(en, VIDA_COTIZACION)) return null;
  return { renglones, fechaEntrega };
};

export const olvidarCotizacion = (telefono: string): void => {
  const c = conversaciones.get(telefono);
  if (c) delete c.cotizacion;
};

// ── Pregunta de cantidad pendiente ──────────────────────────────────────

/** Se llama al mandar un "cuantos kilos de pechuga va a necesitar?". */
export const recordarPreguntaKg = (
  telefono: string,
  producto_id: string,
  nombre: string
): void => {
  abrir(telefono).preguntaKg = { producto_id, nombre, en: Date.now() };
};

export const tomarPreguntaKg = (
  telefono: string
): { producto_id: string; nombre: string } | null => {
  const c = conversaciones.get(telefono);
  if (!c?.preguntaKg) return null;
  const { producto_id, nombre, en } = c.preguntaKg;
  delete c.preguntaKg;
  if (!vigente(en, VIDA_PREGUNTA_KG)) return null;
  return { producto_id, nombre };
};

// ── Mensaje identico repetido ───────────────────────────────────────────

const normalizarTexto = (t: string): string =>
  t.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Si el cliente reenvia el MISMO texto en los proximos minutos, se le repite
 * la respuesta que ya se le dio en vez de volver a procesarlo.
 *
 * Esto pasa constantemente: el cliente no ve la palomita, cree que no llego y
 * reenvia. La deduplicacion por `wa_message_id` no lo cubre porque es un
 * mensaje nuevo de verdad, con id distinto.
 */
export const respuestaRepetida = (telefono: string, texto: string): string | null => {
  const c = conversaciones.get(telefono);
  if (!c?.ultimaRespuesta) return null;
  const { texto: previo, respuesta, en } = c.ultimaRespuesta;
  if (!vigente(en, VIDA_RESPUESTA)) return null;
  return normalizarTexto(texto) === previo ? respuesta : null;
};

export const recordarRespuesta = (
  telefono: string,
  texto: string,
  respuesta: string
): void => {
  abrir(telefono).ultimaRespuesta = {
    texto: normalizarTexto(texto),
    respuesta,
    en: Date.now()
  };
};

// ── Pedido recien creado ────────────────────────────────────────────────

/** Huella de un pedido: los mismos cortes con los mismos kilos. */
export const firmaPedido = (renglones: Renglon[]): string =>
  renglones
    .map((r) => `${r.producto_id}:${r.kg}`)
    .sort()
    .join('|');

/**
 * Devuelve el resumen del pedido anterior si este es el mismo, recien hecho.
 *
 * Esta es la ultima red antes de despachar el doble de pollo. Cubre el caso
 * que la cache de texto no cubre: el cliente reescribe su pedido con otras
 * palabras ("20 kilos de pechuga" y luego "mandame 20 de pechuga") y los dos
 * mensajes producen exactamente los mismos renglones.
 */
export const pedidoDuplicado = (telefono: string, firma: string): string | null => {
  const c = conversaciones.get(telefono);
  if (!c?.ultimoPedido) return null;
  const { firma: previa, resumen, en } = c.ultimoPedido;
  if (!vigente(en, VIDA_PEDIDO)) return null;
  return previa === firma ? resumen : null;
};

export const recordarPedido = (telefono: string, firma: string, resumen: string): void => {
  abrir(telefono).ultimoPedido = { firma, resumen, en: Date.now() };
};

/** Solo para pruebas. */
export const olvidarTodo = (): void => conversaciones.clear();
