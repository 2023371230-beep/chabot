import { supabase } from '../../database/supabase.client';
import { env } from '../../config/env';
import { enviarMensaje } from './whatsapp.client';

/**
 * El apagado controlado del bot.
 *
 * Hay situaciones que un bot no debe intentar resolver: un regateo, un
 * reclamo de calidad, un pedido de 300 kg cuando hay 40 en camara. Insistir en
 * automatizarlas es peor que no contestar, porque el cliente recibe una
 * respuesta segura de si misma y equivocada.
 *
 * Cuando pasa una de esas, este modulo hace tres cosas:
 *
 *   1. PAUSA el bot para ese telefono. Deja de contestar por completo hasta
 *      que una persona lo reanude desde el dashboard. Es la parte que mas
 *      importa: si el bot siguiera contestando por debajo, se pisaria con el
 *      asesor y el cliente veria dos voces distintas en el mismo chat.
 *   2. Deja el motivo escrito en la base, para que se vea en el dashboard.
 *   3. Avisa al encargado por WhatsApp.
 *
 * OJO con el aviso por WhatsApp: la Cloud API solo deja mandar texto libre a
 * un numero que haya escrito en las ultimas 24 horas. El aviso al encargado
 * funciona mientras el encargado le escriba algo al bot de vez en cuando;
 * fuera de esa ventana Meta lo rechaza con el error 131047 y haria falta una
 * plantilla aprobada. Por eso el canal que manda es el dashboard: el aviso de
 * WhatsApp es un extra que puede fallar, y si falla se registra sin romper
 * nada.
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

/** Como se le explica cada motivo a la persona que va a tomar el chat. */
const ETIQUETA: Record<MotivoHandoff, string> = {
  queja: 'Reclamo de calidad',
  enojo: 'Cliente molesto',
  negociacion: 'Pide descuento o credito',
  logistica: 'Pregunta por entrega, direccion o pago',
  solicitud: 'Pidio hablar con una persona',
  sin_stock: 'Pedido mayor al stock disponible',
  modificacion: 'Quiere cambiar un pedido ya hecho',
  sin_cuota: 'Se agoto la cuota del asistente',
  no_entendido: 'El bot no entendio despues de varios intentos'
};

/**
 * Lo que se le dice al cliente. Nunca menciona la palabra "bot", "sistema" ni
 * "limite": al cliente no le importa la infraestructura, le importa que
 * alguien le atienda y saber cuanto va a esperar.
 */
const RESPUESTA: Record<MotivoHandoff, string> = {
  queja:
    'Lamentamos mucho esto. Queremos resolverlo de inmediato: un asesor toma este chat personalmente en los proximos minutos.',
  enojo:
    'Entiendo su molestia y quiero ayudarle. Ya pase su caso con el encargado, le contesta en unos minutos por aqui mismo.',
  negociacion:
    'Los precios y las condiciones de pago se manejan directamente con administracion. Ya pase su mensaje al encargado para que le atienda en un momento.',
  logistica:
    'Para la entrega y la forma de pago le contesta directamente una persona, que es quien coordina las rutas. Ya le pase su mensaje.',
  solicitud: 'Claro que si. En un momento le contesta una persona por aqui mismo.',
  sin_stock:
    'Por el momento no tenemos esa cantidad para entrega inmediata. Un asesor le escribe para coordinar un surtido parcial o programarlo.',
  modificacion:
    'Para no equivocarme con el cambio, en un momento le contesta una persona y se lo ajusta.',
  sin_cuota:
    'Deme un momento, en seguida le contesta una persona para tomar su pedido.',
  no_entendido:
    'Disculpe, no logro entenderle bien por aqui. Le paso el chat a una persona que le atiende en un momento.'
};

export type ChatPausado = {
  id: string;
  telefono: string;
  motivo: MotivoHandoff;
  detalle: string | null;
  nombreCliente: string | null;
  pausadoEn: string;
  ultimoMensaje: string | null;
};

type ContextoHandoff = {
  motivo: MotivoHandoff;
  detalle?: string;
  nombre_cliente?: string;
  pausado_en: string;
  ultimo_mensaje?: string;
};

/**
 * True si el bot debe quedarse callado con este numero.
 *
 * Se consulta en CADA mensaje antes de cualquier otra cosa. Es una lectura de
 * mas por mensaje, pero es lo que garantiza que el asesor no compita con el
 * bot dentro del mismo chat.
 */
export const estaPausada = async (telefono: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('conversaciones_whatsapp')
    .select('id')
    .eq('telefono', telefono)
    .eq('estado', 'escalado_humano')
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    // Si no se puede saber, el bot sigue trabajando. Dejar a todos los
    // clientes sin respuesta por un error de lectura seria peor que el riesgo
    // de que el bot conteste en un chat que ya tomo una persona.
    console.error('[handoff] no se pudo consultar la pausa:', error.message);
    return false;
  }

  return Boolean(data);
};

/**
 * Pausa el bot, deja constancia y avisa al encargado.
 *
 * Devuelve el texto que hay que mandarle al cliente. Nunca lanza: si algo
 * falla al registrar el handoff, el cliente igual recibe su respuesta.
 */
export const pausar = async (params: {
  telefono: string;
  motivo: MotivoHandoff;
  detalle?: string;
  nombreCliente?: string;
  ultimoMensaje?: string;
}): Promise<string> => {
  const { telefono, motivo, detalle, nombreCliente, ultimoMensaje } = params;

  try {
    await registrar(telefono, motivo, detalle, nombreCliente, ultimoMensaje);
    await avisarAlEncargado(telefono, motivo, detalle, nombreCliente, ultimoMensaje);
  } catch (e) {
    console.error('[handoff] no se pudo registrar:', e instanceof Error ? e.message : e);
  }

  return RESPUESTA[motivo];
};

const registrar = async (
  telefono: string,
  motivo: MotivoHandoff,
  detalle?: string,
  nombreCliente?: string,
  ultimoMensaje?: string
): Promise<void> => {
  const contexto: ContextoHandoff = {
    motivo,
    detalle,
    nombre_cliente: nombreCliente,
    pausado_en: new Date().toISOString(),
    ultimo_mensaje: ultimoMensaje
  };

  // El indice unico sobre telefono es PARCIAL (solo conversaciones no
  // cerradas), y PostgREST no puede apoyarse en un indice parcial para hacer
  // upsert. Por eso se busca y se decide a mano.
  const { data: viva } = await supabase
    .from('conversaciones_whatsapp')
    .select('id, estado')
    .eq('telefono', telefono)
    .neq('estado', 'cerrada')
    .is('deleted_at', null)
    .maybeSingle();

  if (viva) {
    await supabase
      .from('conversaciones_whatsapp')
      .update({
        estado: 'escalado_humano',
        contexto,
        ultimo_mensaje_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', viva.id);
  } else {
    await supabase.from('conversaciones_whatsapp').insert({
      telefono,
      estado: 'escalado_humano',
      contexto
    });
  }

  // Rastro en el hilo de mensajes: al abrir el chat en el dashboard se ve
  // POR QUE se detuvo el bot, sin tener que adivinarlo del contexto.
  await supabase.from('mensajes_whatsapp').insert({
    telefono,
    mensaje: `[HANDOFF] ${ETIQUETA[motivo]}${detalle ? ` — ${detalle}` : ''}`,
    tipo: 'sistema',
    procesado: false
  });
};

/**
 * El aviso al celular del encargado.
 *
 * Va con enlace directo al chat en el dashboard: sin el, la alerta obliga a
 * buscar al cliente a mano, que es justo la friccion que hace que las alertas
 * se ignoren.
 */
const avisarAlEncargado = async (
  telefono: string,
  motivo: MotivoHandoff,
  detalle?: string,
  nombreCliente?: string,
  ultimoMensaje?: string
): Promise<void> => {
  const destino = env.whatsapp.alertaNumero;
  if (!destino) return; // Sin numero configurado, el dashboard es el canal.

  const quien = nombreCliente ? `${nombreCliente} (${telefono})` : telefono;
  const texto = [
    `ALERTA — ${ETIQUETA[motivo]}`,
    '',
    `Cliente: ${quien}`,
    detalle ? `Detalle: ${detalle}` : null,
    ultimoMensaje ? `Escribio: "${recortar(ultimoMensaje, 140)}"` : null,
    '',
    'El bot ya se detuvo en ese chat.',
    `${env.dashboardUrl}/whatsapp?telefono=${encodeURIComponent(telefono)}`
  ]
    .filter(Boolean)
    .join('\n');

  const envio = await enviarMensaje(destino, texto);

  if (!envio.enviado) {
    // Se registra pero no se reintenta: el dashboard ya tiene la alerta y
    // reintentar contra la ventana de 24 h de Meta no la va a abrir.
    console.warn(`[handoff] no se pudo avisar al encargado: ${envio.error}`);
  }
};

const recortar = (t: string, n: number): string =>
  t.length > n ? `${t.slice(0, n)}...` : t;

/** Los chats esperando a una persona, del que lleva mas tiempo al mas nuevo. */
export const listarPendientes = async (): Promise<ChatPausado[]> => {
  const { data, error } = await supabase
    .from('conversaciones_whatsapp')
    .select('id, telefono, contexto, ultimo_mensaje_at, updated_at')
    .eq('estado', 'escalado_humano')
    .is('deleted_at', null)
    .order('updated_at', { ascending: true });

  if (error) {
    console.error('[handoff] no se pudieron listar:', error.message);
    return [];
  }

  return (data ?? []).map((row) => {
    const ctx = (row.contexto ?? {}) as ContextoHandoff;
    return {
      id: row.id as string,
      telefono: row.telefono as string,
      motivo: ctx.motivo ?? 'solicitud',
      detalle: ctx.detalle ?? null,
      nombreCliente: ctx.nombre_cliente ?? null,
      pausadoEn: ctx.pausado_en ?? (row.updated_at as string),
      ultimoMensaje: ctx.ultimo_mensaje ?? null
    };
  });
};

/**
 * Devuelve el chat al bot.
 *
 * Se llama desde el dashboard cuando el asesor ya resolvio lo que el bot no
 * podia. La conversacion vuelve a 'abierta', no se cierra: el cliente puede
 * seguir pidiendo con normalidad.
 */
export const reanudar = async (telefono: string): Promise<boolean> => {
  const { error } = await supabase
    .from('conversaciones_whatsapp')
    .update({
      estado: 'abierta',
      updated_at: new Date().toISOString()
    })
    .eq('telefono', telefono)
    .eq('estado', 'escalado_humano');

  if (error) {
    console.error('[handoff] no se pudo reanudar:', error.message);
    return false;
  }

  await supabase.from('mensajes_whatsapp').insert({
    telefono,
    mensaje: '[HANDOFF] Un asesor devolvio el chat al asistente',
    tipo: 'sistema',
    procesado: true
  });

  return true;
};

/** El texto que le toca al cliente por cada motivo, para reutilizarlo. */
export const respuestaDeHandoff = (motivo: MotivoHandoff): string => RESPUESTA[motivo];
