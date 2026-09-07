import { supabase } from '../../database/supabase.client';
import { env } from '../../config/env';
import { enviarMensaje } from './whatsapp.client';
import { ETIQUETA_MOTIVO, recortar, type MotivoHandoff } from '../../../shared/handoff';
import { MINUTOS_SILENCIO, reactivar } from './whatsapp.silencio';
import type { Memoria } from './whatsapp.memoria';
import type { Atencion } from './whatsapp.types';

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

/**
 * Lo unico que `pausar` necesita de la `Memoria`.
 *
 * Se declara la forma en vez de importar la clase para no crear un ciclo entre
 * los dos modulos: la memoria no sabe nada del handoff y el handoff solo
 * necesita poder marcar.
 */
export type MemoriaEscalable = {
  marcarEscalado(datos: {
    motivo: string;
    detalle?: string;
    nombreCliente?: string;
    ultimoMensaje?: string;
    silencioMinutos?: number;
  }): void;
};

// El tipo y las etiquetas viven en `lib/handoff.ts`, que es puro y lo puede
// importar tambien el navegador: antes habia una copia aqui y otra en el hook,
// y ya habian divergido — el mismo chat se anunciaba con un texto por WhatsApp
// y con otro distinto en el dashboard.
export type { MotivoHandoff };

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

/** La forma de las llaves de handoff dentro de `conversaciones_whatsapp.contexto`. */
type ContextoHandoff = {
  motivo?: MotivoHandoff;
  detalle?: string;
  nombre_cliente?: string;
  pausado_en?: string;
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
 * El motivo NO se escribe aqui: se deja en la `Memoria` que el servicio ya
 * tiene cargada, y esa la persiste con su unica escritura al final del
 * mensaje. Antes este modulo leia la conversacion otra vez y la escribia por
 * su cuenta, y despues `guardar()` la sobrescribia con el contexto anterior al
 * escalamiento: el motivo se perdia y el dashboard mostraba "Pidio hablar con
 * alguien" para todo. Una sola fuente y una sola escritura.
 *
 * Devuelve el texto para el cliente. Nunca lanza: si falla el rastro o el
 * aviso, el cliente igual recibe su respuesta.
 */
export const pausar = async (params: {
  telefono: string;
  memoria: MemoriaEscalable;
  motivo: MotivoHandoff;
  detalle?: string;
  nombreCliente?: string;
  ultimoMensaje?: string;
}): Promise<string> => {
  const { telefono, memoria, motivo, detalle, nombreCliente, ultimoMensaje } = params;

  // Escalar hace DOS cosas: mete el chat en la bandeja (hasta que alguien lo
  // resuelva) y calla al bot 12 horas. Pasadas esas horas el bot vuelve a
  // tomar pedidos — mejor eso que silencio eterno — pero el chat sigue en la
  // bandeja para que nadie olvide el reclamo.
  memoria.marcarEscalado({
    motivo,
    detalle,
    nombreCliente,
    ultimoMensaje,
    silencioMinutos: MINUTOS_SILENCIO.handoff
  });

  try {
    // El rastro y el aviso son independientes: no hay razon para esperar uno
    // antes de empezar el otro, y el aviso es un viaje a Meta que el cliente
    // paga en su tiempo de respuesta.
    await Promise.all([
      dejarRastro(telefono, motivo, detalle),
      avisarAlEncargado(telefono, motivo, detalle, nombreCliente, ultimoMensaje)
    ]);
  } catch (e) {
    console.error('[handoff] no se pudo registrar:', e instanceof Error ? e.message : e);
  }

  return RESPUESTA[motivo];
};

/**
 * Rastro en el hilo de mensajes.
 *
 * Al abrir el chat en el dashboard se ve POR QUE se detuvo el bot, sin tener
 * que adivinarlo del contexto.
 */
const dejarRastro = async (
  telefono: string,
  motivo: MotivoHandoff,
  detalle?: string
): Promise<void> => {
  await supabase.from('mensajes_whatsapp').insert({
    telefono,
    mensaje: `[HANDOFF] ${ETIQUETA_MOTIVO[motivo]}${detalle ? ` — ${detalle}` : ''}`,
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
    `ALERTA — ${ETIQUETA_MOTIVO[motivo]}`,
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
  // Limpia las DOS cosas de una vez: sale de la bandeja y deja de estar
  // callado. Antes solo cambiaba el estado, asi que el bot seguia mudo hasta
  // que caducara la pausa aunque el asesor ya hubiera terminado.
  const ok = await reactivar(telefono);
  if (!ok) return false;

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


/**
 * Pausa el bot y devuelve lo que se le dice al cliente.
 *
 * Todo handoff pasa por aqui para que no exista ni un solo camino que
 * escale sin avisar al encargado.
 */
export async function pasarAPersona(params: {
  telefono: string;
  memoria: Memoria;
  motivo: MotivoHandoff;
  detalle?: string;
  nombrePerfil?: string;
  texto?: string;
}): Promise<Atencion> {
  params.memoria.limpiarFallos();
  const respuesta = await pausar({
    telefono: params.telefono,
    memoria: params.memoria,
    motivo: params.motivo,
    detalle: params.detalle,
    nombreCliente: params.nombrePerfil,
    ultimoMensaje: params.texto
  });
  return { respuesta };
}