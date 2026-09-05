import { supabase } from '../../database/supabase.client';

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
 *   Cliente: "mandame 20 de pechuga"
 *   -> dos pedidos, 40 kilos despachados             <- este cuesta pollo real
 *
 * POR QUE VIVE EN LA BASE Y NO EN MEMORIA DEL PROCESO
 *
 * Antes era un Map en memoria, que funciona perfecto en un servidor que corre
 * todo el dia. En Vercel no: cada peticion puede caer en una instancia
 * distinta y las instancias se apagan solas sin trafico. El "si porfa" del
 * cliente llegaria a un proceso que nunca vio la cotizacion, y la huella que
 * evita duplicar el pedido tampoco sobreviviria.
 *
 * COMO SE USA
 *
 * Se carga UNA vez por mensaje, se trabaja en memoria de forma sincrona, y se
 * guarda solo si algo cambio:
 *
 *     const m = await Memoria.cargar(telefono);
 *     if (m.pausada) return;             // el asesor tomo el chat
 *     const cot = m.tomarCotizacion();
 *     ...
 *     await m.guardar();                 // no escribe si nada cambio
 *
 * Asi es una lectura y como mucho una escritura por mensaje, y de paso esa
 * misma lectura contesta si el chat esta pausado — que antes era otra consulta
 * aparte.
 */

export type Renglon = { producto_id: string; kg: number };

/** Cuanto vale cada recuerdo antes de volverse basura. */
const VIDA_COTIZACION = 30 * 60_000; // media hora: da tiempo a consultarlo
const VIDA_PREGUNTA_KG = 15 * 60_000;
const VIDA_RESPUESTA = 3 * 60_000; // ventana del "se me fue el mensaje"
const VIDA_PEDIDO = 10 * 60_000; // ventana del reenvio por desesperacion

/** Lo que se guarda en `conversaciones_whatsapp.contexto`. */
type Contexto = {
  cotizacion?: { renglones: Renglon[]; fechaEntrega?: string; en: number };
  preguntaKg?: { producto_id: string; nombre: string; en: number };
  ultimaRespuesta?: { texto: string; respuesta: string; en: number };
  ultimoPedido?: { firma: string; resumen: string; en: number };
  /** Veces seguidas que el bot no entendio. */
  fallos?: number;
  // El handoff escribe estas mismas llaves; se conservan al guardar para no
  // borrar el motivo por el que una persona tomo el chat.
  motivo?: string;
  detalle?: string;
  nombre_cliente?: string;
  pausado_en?: string;
  ultimo_mensaje?: string;
};

const vigente = (en: number, vida: number): boolean => Date.now() - en < vida;

const normalizarTexto = (t: string): string =>
  t.toLowerCase().replace(/\s+/g, ' ').trim();

/** Huella de un pedido: los mismos cortes con los mismos kilos. */
export const firmaPedido = (renglones: Renglon[]): string =>
  renglones
    .map((r) => `${r.producto_id}:${r.kg}`)
    .sort()
    .join('|');

export class Memoria {
  private constructor(
    readonly telefono: string,
    /** true si una persona tomo el chat y el bot debe callarse. */
    readonly pausada: boolean,
    private ctx: Contexto,
    private readonly conversacionId: string | null,
    private sucia = false
  ) {}

  /**
   * Trae de la base todo lo que se sabe de esta conversacion.
   *
   * Si falla la lectura devuelve una memoria vacia y NO pausada: dejar al
   * cliente sin respuesta por un error de red seria peor que perder el hilo
   * de una cotizacion.
   */
  static async cargar(telefono: string): Promise<Memoria> {
    const { data, error } = await supabase
      .from('conversaciones_whatsapp')
      .select('id, estado, contexto')
      .eq('telefono', telefono)
      .neq('estado', 'cerrada')
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      console.error('[memoria] no se pudo leer la conversacion:', error.message);
      return new Memoria(telefono, false, {}, null);
    }

    return new Memoria(
      telefono,
      data?.estado === 'escalado_humano',
      (data?.contexto ?? {}) as Contexto,
      (data?.id as string) ?? null
    );
  }

  /** Escribe solo si algo cambio. Un mensaje de cortesia no toca la base. */
  async guardar(): Promise<void> {
    if (!this.sucia) return;

    const ahora = new Date().toISOString();

    if (this.conversacionId) {
      const { error } = await supabase
        .from('conversaciones_whatsapp')
        .update({ contexto: this.ctx, ultimo_mensaje_at: ahora, updated_at: ahora })
        .eq('id', this.conversacionId);
      if (error) console.error('[memoria] no se pudo guardar:', error.message);
      return;
    }

    const { error } = await supabase.from('conversaciones_whatsapp').insert({
      telefono: this.telefono,
      estado: 'abierta',
      contexto: this.ctx
    });

    // Dos mensajes del mismo cliente casi al mismo tiempo pueden intentar
    // crear la conversacion a la vez; el indice unico parcial deja pasar solo
    // a uno. Perder el contexto de ese mensaje no rompe nada.
    if (error && error.code !== '23505') {
      console.error('[memoria] no se pudo crear la conversacion:', error.message);
    }
  }

  private cambio(): void {
    this.sucia = true;
  }

  // ── Cotizacion pendiente ──────────────────────────────────────────────

  /** Se llama al mandar un "le sale en $X. Se lo aparto?". */
  recordarCotizacion(renglones: Renglon[], fechaEntrega?: string): void {
    this.ctx.cotizacion = { renglones, fechaEntrega, en: Date.now() };
    this.cambio();
  }

  /**
   * Devuelve la cotizacion pendiente y la borra.
   *
   * Se borra al leerla a proposito: un "si" solo puede convertir la cotizacion
   * en pedido UNA vez. Si el cliente manda "si" dos veces, el segundo ya no
   * encuentra nada y no crea un pedido duplicado.
   */
  tomarCotizacion(): { renglones: Renglon[]; fechaEntrega?: string } | null {
    const c = this.ctx.cotizacion;
    if (!c) return null;
    delete this.ctx.cotizacion;
    this.cambio();
    if (!vigente(c.en, VIDA_COTIZACION)) return null;
    return { renglones: c.renglones, fechaEntrega: c.fechaEntrega };
  }

  olvidarCotizacion(): void {
    if (!this.ctx.cotizacion) return;
    delete this.ctx.cotizacion;
    this.cambio();
  }

  // ── Pregunta de cantidad pendiente ────────────────────────────────────

  /** Se llama al mandar un "cuantos kilos de pechuga va a necesitar?". */
  recordarPreguntaKg(producto_id: string, nombre: string): void {
    this.ctx.preguntaKg = { producto_id, nombre, en: Date.now() };
    this.cambio();
  }

  tomarPreguntaKg(): { producto_id: string; nombre: string } | null {
    const p = this.ctx.preguntaKg;
    if (!p) return null;
    delete this.ctx.preguntaKg;
    this.cambio();
    if (!vigente(p.en, VIDA_PREGUNTA_KG)) return null;
    return { producto_id: p.producto_id, nombre: p.nombre };
  }

  // ── Mensaje identico repetido ─────────────────────────────────────────

  /**
   * Si el cliente reenvia el MISMO texto en los proximos minutos, se le repite
   * la respuesta que ya se le dio en vez de volver a procesarlo.
   *
   * Pasa constantemente: el cliente no ve la palomita, cree que no llego y
   * reenvia. La deduplicacion por `wa_message_id` no lo cubre, porque es un
   * mensaje nuevo de verdad, con id distinto.
   */
  respuestaRepetida(texto: string): string | null {
    const u = this.ctx.ultimaRespuesta;
    if (!u || !vigente(u.en, VIDA_RESPUESTA)) return null;
    return normalizarTexto(texto) === u.texto ? u.respuesta : null;
  }

  recordarRespuesta(texto: string, respuesta: string): void {
    this.ctx.ultimaRespuesta = {
      texto: normalizarTexto(texto),
      respuesta,
      en: Date.now()
    };
    this.cambio();
  }

  // ── Pedido recien creado ──────────────────────────────────────────────

  /**
   * El resumen del pedido anterior si este es el mismo, recien hecho.
   *
   * Es la ultima red antes de despachar el doble de pollo. Cubre el caso que
   * la cache de texto no cubre: el cliente reescribe su pedido con otras
   * palabras y los dos mensajes producen exactamente los mismos renglones.
   */
  pedidoDuplicado(firma: string): string | null {
    const p = this.ctx.ultimoPedido;
    if (!p || !vigente(p.en, VIDA_PEDIDO)) return null;
    return p.firma === firma ? p.resumen : null;
  }

  recordarPedido(firma: string, resumen: string): void {
    this.ctx.ultimoPedido = { firma, resumen, en: Date.now() };
    this.cambio();
  }

  // ── Fallos seguidos ───────────────────────────────────────────────────

  /**
   * Cuantas veces seguidas el bot no ha entendido a este cliente.
   *
   * Es la red final: por muchas reglas que se escriban siempre habra una forma
   * de escribir que no previmos. Tres "no le entendi" seguidos son la señal de
   * que insistir no va a funcionar, y ahi entra una persona. Sin esto el
   * cliente se queda en un bucle educado hasta que se harta y se va.
   */
  contarFallo(): number {
    this.ctx.fallos = (this.ctx.fallos ?? 0) + 1;
    this.cambio();
    return this.ctx.fallos;
  }

  /** Cualquier mensaje bien atendido borra la cuenta: no se acumula historia. */
  limpiarFallos(): void {
    if (this.ctx.fallos === undefined) return;
    delete this.ctx.fallos;
    this.cambio();
  }
}
