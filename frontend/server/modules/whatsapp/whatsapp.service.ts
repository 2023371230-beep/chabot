import { DUPLICADO, supabase } from '../../database/supabase.client';
import { aiService } from '../ai/ai.service';
import { clientesService } from '../clientes/clientes.service';
import { pedidosService } from '../pedidos/pedidos.service';
import { productosService } from '../productos/productos.service';
import { formatCurrency, formatKg } from '../../shared/utils/format.utils';
import { aMinutos } from '../../shared/utils/text.utils';
import { buscarProducto, interpretarFecha } from './whatsapp.matcher';
import {
  clasificar,
  saludoPorHora,
  MAX_CARACTERES_IA,
  type IntencionRapida
} from './whatsapp.intents';
import { configuracionService } from '../configuracion/configuracion.service';
import { enviarMensaje, marcarComoLeido } from './whatsapp.client';
import { puedeUsarIA, registrarUso } from './whatsapp.presupuesto';
import { pausar, type MotivoHandoff } from './whatsapp.handoff';
import { firmaPedido, Memoria, type Renglon } from './whatsapp.memoria';
import { MINUTOS_SILENCIO, silenciar } from './whatsapp.silencio';
import {
  esSoloEstados,
  extraerEcos,
  extraerMensajes,
  type EcoSaliente,
  type MensajeEntrante,
  type MetaWebhookPayload
} from './whatsapp.types';



/**
 * Tope de kilos por renglon antes de dudar.
 *
 * Un pedido de mayoreo grande son 200 o 300 kilos. Arriba de 500 casi siempre
 * es un dedazo ("2000" en vez de "200") o la IA leyendo mal un numero de
 * telefono. Despachar eso vacia el almacen, asi que se pregunta.
 */
const MAX_KG_RAZONABLE = 500;

/**
 * Cuando el stock se considera insuficiente de verdad.
 *
 * No se frena por faltar un kilo: casi siempre entra mercancia antes de la
 * entrega y rechazar por eso perderia ventas — para esos casos `createOrder`
 * ya devuelve su aviso de stock. Se escala solo cuando la diferencia es grande
 * en las DOS medidas: mas del doble de lo que hay, y al menos 20 kg de mas.
 * Pedir 80 habiendo 30 cumple las dos; pedir 25 habiendo 20, ninguna.
 */
const FACTOR_STOCK_INSUFICIENTE = 2;
const MARGEN_KG_TOLERADO = 20;

/**
 * Cambios de opinion sobre el mismo borrador antes de llamar a una persona.
 *
 * Afinar un pedido es normal: "mejor 30", "agregale alitas". Lo que no es
 * normal es el cuarto cambio sin cerrar — ahi el cliente no esta afinando,
 * esta dudando, y lo que necesita es alguien que le ayude a decidir. Dejarlo
 * dando vueltas con el bot solo alarga la duda.
 */
const MAX_CAMBIOS_BORRADOR = 3;

/**
 * El cierre de todo borrador, y la doble confirmacion en una linea.
 *
 * Dice dos cosas que tienen que quedar explicitas: que el pedido TODAVIA no
 * existe, y exactamente que hacer para que exista. Sin la primera el cliente
 * se va creyendo que ya esta apartado; sin la segunda contesta cualquier cosa
 * y el "si" no se reconoce.
 */
const PIDE_CONFIRMACION = 'Todavia no lo anoto. Me lo confirma con un "si" y se lo aparto.';

type ResultadoMensaje = {
  wamid: string;
  telefono: string;
  procesado: boolean;
  motivo?: string;
  respuesta?: string;
  pedidoId?: string;
};

type Atencion = { respuesta: string; pedidoId?: string };

/** Un pedido con lo que hace falta para hablar de el con el cliente. */
type PedidoDelCliente = {
  id: string;
  estado: string;
  fecha_entrega: string | null;
  total_kg: number | string;
  total_precio: number | string;
  created_at: string;
  pedido_detalles?: Array<{
    producto_id: string;
    kg: number | string;
    productos?: { nombre?: string } | null;
  }>;
};

export const whatsappService = {
  async procesarWebhook(payload: MetaWebhookPayload): Promise<ResultadoMensaje[]> {
    // Los acuses de entrega llegan por el mismo canal que los mensajes. Si se
    // trataran igual, el bot se responderia a si mismo en bucle.
    if (esSoloEstados(payload)) return [];

    // Los ecos van PRIMERO: si el dueño acaba de contestar desde su celular,
    // el bot tiene que callarse antes de tocar cualquier mensaje entrante que
    // venga en el mismo payload.
    for (const eco of extraerEcos(payload)) {
      await this.registrarEco(eco);
    }

    const mensajes = extraerMensajes(payload);
    const resultados: ResultadoMensaje[] = [];
    for (const mensaje of mensajes) {
      resultados.push(await this.procesarMensaje(mensaje));
    }
    return resultados;
  },

  async procesarMensaje(mensaje: MensajeEntrante): Promise<ResultadoMensaje> {
    const base = { wamid: mensaje.wamid, telefono: mensaje.telefono };

    if (!mensaje.telefono) {
      return { ...base, procesado: false, motivo: 'Mensaje sin telefono' };
    }

    // 1. Deduplicacion ANTES de procesar: la restriccion UNIQUE sobre
    //    wa_message_id es lo que corta los reintentos de Meta.
    const { data: guardado, error } = await supabase
      .from('mensajes_whatsapp')
      .insert({
        telefono: mensaje.telefono,
        mensaje: mensaje.texto || `[${mensaje.tipo}]`,
        tipo: 'cliente',
        wa_message_id: mensaje.wamid,
        procesado: false,
        payload: mensaje as unknown as Record<string, unknown>
      })
      .select('id')
      .single();

    if (error) {
      if (error.code === DUPLICADO) {
        return { ...base, procesado: false, motivo: 'Mensaje duplicado' };
      }
      console.error('[whatsapp] no se pudo guardar:', error.message);
      return { ...base, procesado: false, motivo: 'Error al guardar' };
    }

    if (!mensaje.wamid.startsWith('test.')) {
      await marcarComoLeido(mensaje.wamid);
    }

    // Audios, fotos, videos, stickers y ubicaciones.
    //
    // Se contesta distinto segun lo que mandaron: un "no leo imagenes" a
    // quien mando una nota de voz suena a que ni se molestaron en mirar. Y
    // decir QUE hacer en su lugar es lo que evita que el cliente reenvie lo
    // mismo tres veces.
    if (mensaje.tipo !== 'text' || !mensaje.texto) {
      const r = respuestaParaNoTexto(mensaje.tipo);
      await this.responder(mensaje.telefono, r, guardado.id);
      return { ...base, procesado: true, motivo: `Tipo no soportado: ${mensaje.tipo}`, respuesta: r };
    }

    // 2. El flujo de negocio.
    const { respuesta, pedidoId } = await this.atender(
      mensaje.texto,
      mensaje.telefono,
      mensaje.nombrePerfil
    );

    // Respuesta vacia = decision deliberada de no contestar (un "👍" suelto).
    // Contestar cada emoji es ruido para el cliente y trabajo de mas.
    if (!respuesta) {
      await supabase.from('mensajes_whatsapp').update({ procesado: true }).eq('id', guardado.id);
      return { ...base, procesado: true, motivo: 'Sin respuesta necesaria' };
    }

    await this.responder(mensaje.telefono, respuesta, guardado.id);

    // El enlace se marca DESPUES de responder para que la confirmacion del bot
    // entre en la conversacion del pedido: es la ultima linea del hilo y la que
    // cierra el trato.
    if (pedidoId) await this.enlazarConversacion(pedidoId, mensaje.telefono);

    return { ...base, procesado: true, respuesta, pedidoId };
  },

  /**
   * Deja constancia de un posible pedido llegado a un chat en silencio.
   *
   * El bot no contesta — hay una persona al mando — pero un pedido que entra
   * mientras nadie mira es una venta perdida sin rastro. La marca aparece en
   * el hilo del dashboard, donde quien atiende el chat la va a ver.
   *
   * Solo se registra si el clasificador cree que hay intencion de compra: un
   * "gracias" en un chat callado no necesita alarma.
   */
  async avisarIntentoEnChatCallado(texto: string, telefono: string): Promise<void> {
    if (clasificar(texto).tipo !== 'usar_ia') return;

    const { error } = await supabase.from('mensajes_whatsapp').insert({
      telefono,
      mensaje: '[ATENCION] Posible pedido recibido mientras el asistente estaba en pausa',
      tipo: 'sistema',
      procesado: false
    });

    if (error) console.error('[whatsapp] no se pudo marcar el intento:', error.message);
  },

  /**
   * Alguien contesto desde fuera de este sistema.
   *
   * Meta avisa con un "eco" cuando sale un mensaje del numero del negocio por
   * otra via — la app de WhatsApp Business en el celular del dueño, o el
   * Business Suite. Es la señal de que una persona ya esta atendiendo ese chat.
   *
   * En ese momento el bot se calla dos horas. Sin esto, el dueño escribe desde
   * su telefono, el cliente responde, y el bot le contesta encima: dos voces
   * distintas diciendo cosas distintas, que es justo lo que la funcion de
   * handoff existe para evitar.
   *
   * El mensaje se guarda como 'asesor' para que aparezca en el hilo del
   * dashboard. Si no, la conversacion tendria huecos inexplicables: el cliente
   * respondiendo a algo que en el historial nadie dijo.
   */
  async registrarEco(eco: EcoSaliente): Promise<void> {
    await silenciar(eco.telefono, MINUTOS_SILENCIO.intervencion, false);

    const { error } = await supabase.from('mensajes_whatsapp').insert({
      telefono: eco.telefono,
      mensaje: eco.texto,
      tipo: 'asesor',
      wa_message_id: eco.wamid,
      procesado: true
    });

    // El UNIQUE sobre wa_message_id corta los reintentos de Meta: el eco de un
    // mensaje que ya se guardo no es un fallo.
    if (error && error.code !== DUPLICADO) {
      console.error('[whatsapp] no se pudo guardar el eco:', error.message);
    }
  },

  /**
   * Marca que estos mensajes fueron los que llevaron a este pedido.
   *
   * La regla no necesita ventanas de tiempo: se reclaman los mensajes de ese
   * telefono que aun no tengan dueño. Los pedidos anteriores ya reclamaron los
   * suyos, asi que lo que queda suelto es por definicion lo que llevo a este.
   * Un cliente que vuelve la semana siguiente estrena conversacion sin que su
   * pedido viejo pierda la que ya tenia.
   *
   * Va por una funcion de la base y no con un select+update desde aqui porque
   * dos mensajes del mismo cliente pueden procesarse a la vez en dos
   * instancias: un update atomico no deja la ventana en la que los dos
   * reclamarian los mismos mensajes.
   */
  async enlazarConversacion(pedidoId: string, telefono: string): Promise<void> {
    const { error } = await supabase.rpc('asignar_conversacion_a_pedido', {
      p_pedido_id: pedidoId,
      p_telefono: telefono
    });

    // No se lanza: el pedido ya esta creado y el cliente ya recibio su
    // confirmacion. Quedarse sin el hilo es una perdida de contexto, no un
    // fallo de negocio.
    if (error) {
      console.error('[whatsapp] no se pudo enlazar la conversacion:', error.message);
    }
  },

  /**
   * Del texto del cliente a la respuesta.
   *
   * El orden importa: primero se descarta lo repetido, luego se clasifica sin
   * IA, y solo lo que de verdad necesita entenderse llega al modelo. La IA
   * SOLO extrae datos; los precios, el stock y el limite de mayoreo los
   * resuelve `pedidosService.createOrder`, la misma ruta que usa el dashboard,
   * para que las reglas no puedan contradecirse.
   */
  async atender(texto: string, telefono: string, nombrePerfil?: string): Promise<Atencion> {
    // 0. La memoria se lee UNA vez por mensaje, y esa misma lectura dice si el
    //    chat esta pausado: no cuesta una consulta aparte.
    //
    //    Si una persona ya tomo el chat, el bot se calla. Contestar por debajo
    //    del asesor haria que el cliente vea dos voces distintas diciendo
    //    cosas distintas en la misma conversacion.
    const memoria = await Memoria.cargar(telefono);

    if (memoria.pausada) {
      // Callado no es sordo. Si el cliente escribe algo que parece un pedido
      // mientras una persona lleva el chat, se deja constancia para que no se
      // pierda una venta por estar el bot en silencio.
      await this.avisarIntentoEnChatCallado(texto, telefono);
      return { respuesta: '' };
    }

    const intencion = clasificar(texto);

    // 1. El cliente reenvio el mismo texto porque no vio la palomita. Se le
    //    repite lo que ya se le contesto en vez de procesarlo otra vez.
    //
    //    Pero la cache NO aplica a las respuestas cortas. "si", "no" y los
    //    numeros sueltos no dicen nada por si solos: contestan a la ultima
    //    pregunta, y la misma palabra significa cosas distintas en dos
    //    momentos distintos. Con la doble confirmacion todo pedido termina en
    //    un "si", asi que sin esta excepcion el segundo pedido de la tarde
    //    recibia el acuse del primero y no se creaba nunca.
    const esRespuesta =
      intencion.tipo === 'confirmacion' ||
      intencion.tipo === 'rechazo' ||
      intencion.tipo === 'solo_numero';

    if (!esRespuesta) {
      const yaContestado = memoria.respuestaRepetida(texto);
      if (yaContestado) return { respuesta: yaContestado };
    }

    const resultado = await this.decidir(intencion, texto, telefono, memoria, nombrePerfil);
    if (resultado.respuesta && !esRespuesta) {
      memoria.recordarRespuesta(texto, resultado.respuesta);
    }

    // Una sola escritura, y solo si algo cambio: un "buenos dias" no toca la base.
    await memoria.guardar();
    return resultado;
  },

  /**
   * Pausa el bot y devuelve lo que se le dice al cliente.
   *
   * Todo handoff pasa por aqui para que no exista ni un solo camino que
   * escale sin avisar al encargado.
   */
  async pasarAPersona(params: {
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
  },

  async decidir(
    intencion: IntencionRapida,
    texto: string,
    telefono: string,
    memoria: Memoria,
    nombrePerfil?: string
  ): Promise<Atencion> {
    const saludo = saludoPorHora();

    switch (intencion.tipo) {
      // Sin contenido: no se contesta. Es la unica rama que devuelve vacio.
      case 'ignorar':
        return { respuesta: '' };

      case 'demasiado_largo':
        return {
          respuesta:
            'Se me hizo muy largo el mensaje para leerlo bien. Digame nada mas el corte y los kilos, por ejemplo: "20 kilos de pechuga para el viernes".'
        };

      case 'humano':
        return this.pasarAPersona({
          telefono,
          memoria,
          motivo: intencion.motivo,
          nombrePerfil,
          texto
        });

      case 'cancelacion':
        return this.atenderCancelacion(telefono, memoria, nombrePerfil, texto);

      case 'modificacion':
        return this.atenderModificacion(texto, telefono, memoria, saludo, nombrePerfil);

      case 'estado_pedido':
        return { respuesta: await this.atenderEstado(telefono) };

      case 'confirmacion':
        return this.atenderConfirmacion(telefono, memoria, nombrePerfil, texto);

      case 'rechazo':
        memoria.olvidarCotizacion();
        return { respuesta: 'Sin problema. Aqui andamos por si se anima mas tarde.' };

      case 'repetir':
        return this.atenderRepetir(telefono, memoria, saludo);

      case 'solo_numero':
        return this.atenderSoloNumero(telefono, memoria, intencion.valor, nombrePerfil);

      case 'saludo':
        return {
          respuesta: `${saludo}! Con gusto le atiendo. Digame que corte necesita y cuantos kilos, por ejemplo: "15 kilos de pierna para manana".`
        };

      case 'agradecimiento':
        return { respuesta: 'Con gusto, para servirle. Aqui andamos para lo que necesite.' };

      case 'despedida':
        return { respuesta: 'Gracias a usted. Que tenga buen dia.' };

      case 'catalogo':
        return { respuesta: await this.armarCatalogo(saludo) };

      case 'horario':
        return { respuesta: await this.armarHorario(saludo) };

      case 'precio':
        return { respuesta: await this.armarPrecio(intencion.texto, saludo) };

      default:
        return this.atenderConIA(
          texto,
          telefono,
          memoria,
          nombrePerfil,
          saludo,
          intencion.traeSaludo
        );
    }
  },

  // ── Ramas que no gastan IA ────────────────────────────────────────────

  /**
   * Cancelaciones.
   *
   * Solo se cancela solo lo que todavia esta PENDIENTE: ahi no se movio stock
   * ni se preparo nada, y deshacerlo no cuesta. Un pedido ya confirmado si
   * toco inventario, y esa decision no la toma un bot.
   */
  async atenderCancelacion(
    telefono: string,
    memoria: Memoria,
    nombrePerfil?: string,
    texto?: string
  ): Promise<Atencion> {
    const [ultimo] = await this.pedidosDelCliente(telefono, 1);

    if (!ultimo) {
      return {
        respuesta:
          'No encuentro ningun pedido suyo abierto. Si quiere hacer uno, digame el corte y los kilos.'
      };
    }

    if (ultimo.estado === 'cancelado') {
      return {
        respuesta: 'Ese pedido ya estaba cancelado. No se preocupe, no se le va a cobrar nada.'
      };
    }

    // Un pedido confirmado ya movio inventario: deshacerlo no es reversible
    // solo, hace falta un ajuste manual. Esa decision no la toma un bot.
    //
    // Y como al cliente se le dice que lo vera una persona, TIENE que pasar de
    // verdad: antes estas dos ramas prometian al encargado y no le avisaban a
    // nadie. Una promesa que el sistema no cumple es peor que negarse.
    if (ultimo.estado !== 'pendiente') {
      const handoff = await this.pasarAPersona({
        telefono,
        memoria,
        motivo: 'modificacion',
        detalle: `Pide cancelar un pedido ya ${ultimo.estado} de ${formatKg(ultimo.total_kg)} (${formatCurrency(ultimo.total_precio)})`,
        nombrePerfil,
        texto
      });
      return {
        respuesta: `Su pedido de ${formatKg(ultimo.total_kg)} ya esta ${ultimo.estado} y ya se preparo. ${handoff.respuesta}`
      };
    }

    try {
      await pedidosService.updateOrderStatus(ultimo.id, 'cancelado');
      return {
        respuesta: `Listo, cancele su pedido de ${formatKg(ultimo.total_kg)} por ${formatCurrency(ultimo.total_precio)}. No se le cobra nada. Cuando guste hacemos otro.`
      };
    } catch (e) {
      console.error('[whatsapp] no se pudo cancelar:', e instanceof Error ? e.message : e);
      const handoff = await this.pasarAPersona({
        telefono,
        memoria,
        motivo: 'modificacion',
        detalle: `Fallo la cancelacion automatica del pedido ${ultimo.id}`,
        nombrePerfil,
        texto
      });
      return { respuesta: `No pude cancelarlo automaticamente. ${handoff.respuesta}` };
    }
  },

  /**
   * "Mejor que sean 30 y no 20".
   *
   * Hay dos casos que parecen el mismo y no lo son:
   *
   * · Sobre un BORRADOR sin confirmar no se ha creado nada, no se movio
   *   inventario y no se le prometio nada a nadie. Cambiarlo es gratis: se
   *   vuelve a cotizar y el borrador nuevo pisa al viejo. Escalar esto seria
   *   llamar a una persona porque el cliente se corrigio a si mismo.
   *
   * · Sobre un PEDIDO ya creado es donde mas facil se duplica el pollo: si
   *   llegara a la IA, extraeria "30 kilos" y crearia un SEGUNDO pedido encima
   *   del de 20. Se le muestra al cliente lo que tiene y lo toma una persona.
   */
  async atenderModificacion(
    texto: string,
    telefono: string,
    memoria: Memoria,
    saludo: string,
    nombrePerfil?: string
  ): Promise<Atencion> {
    const borrador = memoria.verBorrador();
    if (borrador) {
      const corregido = await this.corregirBorrador(texto, telefono, memoria, borrador, nombrePerfil);
      if (corregido) return corregido;
      return this.atenderConIA(texto, telefono, memoria, nombrePerfil, saludo, false);
    }

    const [ultimo] = await this.pedidosDelCliente(telefono, 1);

    if (!ultimo) {
      // Sin pedido previo no hay nada que cambiar: es un pedido nuevo mal
      // escrito, y eso si lo puede tomar el bot.
      return {
        respuesta:
          'No tengo ningun pedido suyo para cambiar. Digame de nuevo el corte y los kilos y se lo anoto.'
      };
    }

    const actual = (ultimo.pedido_detalles ?? [])
      .map((d) => `${formatKg(d.kg)} de ${d.productos?.nombre ?? 'producto'}`)
      .join(', ');

    const handoff = await this.pasarAPersona({
      telefono,
      memoria,
      motivo: 'modificacion',
      detalle: `Pedido actual: ${actual} (${formatCurrency(ultimo.total_precio)})`,
      nombrePerfil,
      texto
    });

    // Se le muestra lo que tiene antes de pasarlo: asi el cliente sabe sobre
    // que se esta hablando y el asesor no empieza de cero.
    return {
      respuesta: [
        'Su pedido ahorita esta asi:',
        '',
        ...(ultimo.pedido_detalles ?? []).map(
          (d) => `  ${formatKg(d.kg)} de ${d.productos?.nombre ?? 'producto'}`
        ),
        '',
        `Total: ${formatKg(ultimo.total_kg)} — ${formatCurrency(ultimo.total_precio)}`,
        '',
        handoff.respuesta
      ].join('\n')
    };
  },

  /**
   * "Mejor que sean 20": corregir la cantidad sin gastar una peticion de IA.
   *
   * Es la correccion mas comun y la que peor se le da al modelo, porque el
   * mensaje NO dice de que corte habla. La IA devolvia un producto vacio y el
   * cliente recibia un "no manejamos ." despues de haberse explicado bien.
   *
   * El dato que falta ya lo tenemos: es el corte que se estaba cotizando. Por
   * eso se resuelve aqui, con una regla, y solo cuando no queda ninguna duda —
   * un unico numero, ningun corte nombrado y un borrador de un solo renglon.
   * En cuanto hay ambiguedad se devuelve `null` y decide la IA.
   */
  async corregirBorrador(
    texto: string,
    telefono: string,
    memoria: Memoria,
    borrador: { renglones: Renglon[]; fechaEntrega?: string; notas?: string },
    nombrePerfil?: string
  ): Promise<Atencion | null> {
    const numeros = texto.match(/\d+(?:[.,]\d+)?/g) ?? [];
    if (numeros.length !== 1) return null;

    const kg = Number(numeros[0].replace(',', '.'));
    if (kg <= 0 || kg > MAX_KG_RAZONABLE) return null;

    const catalogo = await productosService.findAll();

    // Si nombra un corte, el cliente esta cambiando de producto y no solo de
    // cantidad: eso si necesita a la IA para leerlo bien.
    if (buscarProducto(texto, catalogo).encontrado) return null;

    // Con varios renglones no se sabe a cual va el numero. Preguntarlo cuesta
    // un mensaje; adivinarlo puede costar la mitad de un pedido.
    if (borrador.renglones.length !== 1) {
      const porId = new Map(catalogo.map((p) => [p.id, p]));
      const nombres = borrador.renglones
        .map((r) => porId.get(r.producto_id)?.nombre)
        .filter(Boolean);
      return {
        respuesta: `Los ${formatKg(kg)} son de ${nombres.join(' o de ')}? Digame de cual y se lo ajusto.`
      };
    }

    const renglones: Renglon[] = [{ producto_id: borrador.renglones[0].producto_id, kg }];

    const faltante = this.revisarStock(renglones, catalogo);
    if (faltante.detalle.length) {
      const handoff = await this.pasarAPersona({
        telefono,
        memoria,
        motivo: 'sin_stock',
        detalle: faltante.detalle.join('; '),
        nombrePerfil,
        texto
      });
      return {
        respuesta: [`${faltante.paraElCliente.join('\n')}.`, '', handoff.respuesta].join('\n')
      };
    }

    return this.proponerBorrador({
      telefono,
      memoria,
      renglones,
      catalogo,
      encabezado: 'Se lo cambio. Queda asi:',
      fechaEntrega: borrador.fechaEntrega,
      notas: borrador.notas,
      nombrePerfil,
      texto
    });
  },

  /** "Ya esta listo mi pedido?" se contesta de la base, no con IA. */
  async atenderEstado(telefono: string): Promise<string> {
    const [ultimo] = await this.pedidosDelCliente(telefono, 1);

    if (!ultimo) {
      return 'No encuentro pedidos suyos. Si quiere hacer uno, digame el corte y los kilos.';
    }

    const detalle = (ultimo.pedido_detalles ?? [])
      .map((d) => `${formatKg(d.kg)} de ${d.productos?.nombre ?? 'producto'}`)
      .join(', ');

    const entrega = ultimo.fecha_entrega ? ` Entrega: ${ultimo.fecha_entrega}.` : '';

    const estados: Record<string, string> = {
      pendiente: 'esta anotado y falta confirmarlo',
      confirmado: 'ya esta confirmado y en preparacion',
      completado: 'ya se entrego',
      cancelado: 'esta cancelado'
    };

    return `Su pedido de ${detalle} ${estados[ultimo.estado] ?? ultimo.estado}.${entrega}`;
  },

  /**
   * "Si, apartamelo": el segundo paso de la doble confirmacion.
   *
   * Aqui, y solo aqui, nace el pedido. Se crea con los renglones que YA se
   * habian resuelto al cotizar: ni una peticion de IA mas, y cero riesgo de
   * que el modelo entienda otra cosa la segunda vez.
   *
   * Entre la cotizacion y el "si" pudo pasar media hora, y el mundo se mueve
   * en ese rato: el stock baja y los precios cambian. Por eso el borrador se
   * revisa contra los numeros de AHORA antes de convertirlo en pedido.
   */
  async atenderConfirmacion(
    telefono: string,
    memoria: Memoria,
    nombrePerfil?: string,
    texto?: string
  ): Promise<Atencion> {
    const borrador = memoria.tomarCotizacion();

    if (!borrador) {
      // Un "va" o un "sale" sueltos son solo un acuse de recibo.
      return { respuesta: 'Perfecto. Cualquier cosa aqui ando.' };
    }

    const catalogo = await productosService.findAll();

    // Un "si" que llega tarde confirma un total que ya puede no ser el de hoy.
    // Se vuelve a cotizar con los precios de ahora y se pregunta otra vez: un
    // mensaje de mas es mas barato que cobrar sobre un precio viejo.
    if (borrador.vencida) {
      memoria.recordarCotizacion(borrador.renglones, {
        fechaEntrega: borrador.fechaEntrega,
        notas: borrador.notas
      });
      return {
        respuesta: this.armarCotizacion(
          borrador.renglones,
          catalogo,
          'Paso un rato desde que le pase el precio. Se lo reviso con los de hoy:',
          { fechaEntrega: borrador.fechaEntrega }
        )
      };
    }

    // El stock pudo moverse mientras el cliente lo pensaba. Confirmar a ciegas
    // convertiria el borrador en una promesa que la bodega no puede cumplir.
    const faltante = this.revisarStock(borrador.renglones, catalogo);
    if (faltante.detalle.length) {
      const handoff = await this.pasarAPersona({
        telefono,
        memoria,
        motivo: 'sin_stock',
        detalle: `Al confirmar ya no alcanzaba: ${faltante.detalle.join('; ')}`,
        nombrePerfil,
        texto
      });
      return {
        respuesta: [
          'Mientras lo pensaba se nos movio el inventario.',
          `${faltante.paraElCliente.join('\n')}.`,
          '',
          handoff.respuesta
        ].join('\n')
      };
    }

    return this.crearPedido({
      telefono,
      memoria,
      nombrePerfil,
      renglones: borrador.renglones,
      catalogo,
      fechaEntrega: borrador.fechaEntrega,
      notas: borrador.notas,
      saludo: null
    });
  },

  /** "Lo de siempre": se lee el ultimo pedido en vez de inventarlo. */
  async atenderRepetir(
    telefono: string,
    memoria: Memoria,
    saludo: string
  ): Promise<Atencion> {
    const [ultimo] = await this.pedidosDelCliente(telefono, 1);

    if (!ultimo?.pedido_detalles?.length) {
      return {
        respuesta: `${saludo}! Todavia no tengo un pedido anterior suyo. Digame que corte necesita y cuantos kilos.`
      };
    }

    const renglones: Renglon[] = ultimo.pedido_detalles.map((d) => ({
      producto_id: d.producto_id,
      kg: Number(d.kg)
    }));

    // Se cotiza con los precios de hoy, no con los que pago la vez pasada: el
    // pedido es igual, el precio no tiene por que serlo.
    const catalogo = await productosService.findAll();

    return this.proponerBorrador({
      telefono,
      memoria,
      renglones,
      catalogo,
      encabezado: `${saludo}! Su ultimo pedido fue asi:`
    });
  },

  /**
   * El cliente contesto "20" a un "cuantos kilos de pechuga?".
   *
   * Sin esta rama el numero suelto iba a la IA, que no tiene forma de saber de
   * que corte hablamos, y el cliente recibia un "no entendi" despues de haber
   * contestado exactamente lo que le preguntamos.
   */
  async atenderSoloNumero(
    telefono: string,
    memoria: Memoria,
    valor: number,
    nombrePerfil?: string
  ): Promise<Atencion> {
    const pendiente = memoria.tomarPreguntaKg();

    if (!pendiente) {
      return {
        respuesta: `${valor} de que corte? Digame por ejemplo "${valor} kilos de pechuga".`
      };
    }

    if (valor <= 0 || valor > MAX_KG_RAZONABLE) {
      memoria.recordarPreguntaKg(pendiente.producto_id, pendiente.nombre);
      return {
        respuesta: `${valor} kilos de ${pendiente.nombre} es bastante. Me confirma la cantidad, porfa?`
      };
    }

    const renglones: Renglon[] = [{ producto_id: pendiente.producto_id, kg: valor }];
    const catalogo = await productosService.findAll();

    const faltante = this.revisarStock(renglones, catalogo);
    if (faltante.detalle.length) {
      const handoff = await this.pasarAPersona({
        telefono,
        memoria,
        motivo: 'sin_stock',
        detalle: faltante.detalle.join('; '),
        nombrePerfil,
        texto: String(valor)
      });
      return {
        respuesta: [`${faltante.paraElCliente.join('\n')}.`, '', handoff.respuesta].join('\n')
      };
    }

    // No se crea nada todavia: el numero suelto contesta a "cuantos kilos?",
    // no confirma un pedido. Se le enseña el total y se le pide el "si".
    return this.proponerBorrador({
      telefono,
      memoria,
      renglones,
      catalogo,
      encabezado: 'Le sale asi:',
      nombrePerfil,
      texto: String(valor)
    });
  },

  // ── Rama que si gasta IA ──────────────────────────────────────────────

  async atenderConIA(
    texto: string,
    telefono: string,
    memoria: Memoria,
    nombrePerfil: string | undefined,
    saludo: string,
    traeSaludo: boolean
  ): Promise<Atencion> {
    // Racionamiento: si ya no hay cuota, se pasa a una persona en vez de
    // fallar. El cliente no tiene por que enterarse de los limites del sistema.
    const cuota = await puedeUsarIA(telefono);
    if (!cuota.permitido) {
      console.warn(`[whatsapp] sin cuota de IA (${cuota.motivo}) para ${telefono}`);
      // Quedarse sin cuota no puede significar quedarse sin atender. Se pasa a
      // una persona, que es exactamente lo que haria un negocio si se le
      // descompone el sistema a media mañana.
      return this.pasarAPersona({
        telefono,
        memoria,
        motivo: 'sin_cuota',
        detalle: `Se agoto la cuota por ${cuota.motivo}`,
        nombrePerfil,
        texto
      });
    }

    let extraido;
    try {
      await registrarUso(telefono);
      // Recorte defensivo: ningun pedido real necesita mas de 400 caracteres,
      // y un mensaje enorme se come los tokens por minuto de todos.
      const salida = await aiService.extractOrderFromMessage(texto.slice(0, MAX_CARACTERES_IA));
      if (!salida.configured) {
        return {
          respuesta:
            'Ahorita no puedo procesar pedidos automaticamente. Un momento y te atiende una persona.'
        };
      }
      extraido = salida.result;
    } catch (e) {
      console.error('[whatsapp] fallo la IA:', e instanceof Error ? e.message : e);
      return {
        respuesta:
          'No pude entender tu mensaje. Escribeme por ejemplo: "20 kilos de pechuga para el viernes".'
      };
    }

    if (!extraido.productos.length) {
      return this.noEntendi(telefono, memoria, texto, nombrePerfil, saludo);
    }

    // Traducir nombres a productos reales del catalogo, sin IA.
    const catalogo = await productosService.findAll();
    const renglones: Renglon[] = [];
    const noEncontrados: string[] = [];
    const sinCantidad: { id: string; nombre: string }[] = [];
    const exagerados: string[] = [];
    let sugerencias: string[] = [];

    for (const item of extraido.productos) {
      const match = buscarProducto(item.nombre_producto, catalogo);

      if (!match.encontrado) {
        noEncontrados.push(item.nombre_producto);
        sugerencias = match.sugerencias;
        continue;
      }
      if (!item.kg || item.kg <= 0) {
        sinCantidad.push({ id: match.producto.id, nombre: match.producto.nombre });
        continue;
      }
      // Cordura: "2000 kilos" casi siempre es un dedazo o un numero mal leido.
      if (item.kg > MAX_KG_RAZONABLE) {
        exagerados.push(`${item.kg} kg de ${match.producto.nombre}`);
        continue;
      }
      renglones.push({ producto_id: match.producto.id, kg: item.kg });
    }

    if (exagerados.length) {
      return {
        respuesta: `Me sale ${exagerados.join(' y ')}, y es bastante. Me confirma la cantidad antes de anotarlo?`
      };
    }

    // Preguntar antes que adivinar. Se recuerda QUE se pregunto, para que el
    // "20" que conteste el cliente no necesite otra peticion de IA.
    if (sinCantidad.length) {
      memoria.recordarPreguntaKg(sinCantidad[0].id, sinCantidad[0].nombre);
      return {
        respuesta: `Claro que si. Cuantos kilos de ${sinCantidad.map((s) => s.nombre).join(' y ')} va a necesitar?`
      };
    }

    if (!renglones.length) {
      const lista = sugerencias.length ? `\n\nTenemos: ${sugerencias.join(', ')}.` : '';
      return { respuesta: `No manejamos ${noEncontrados.join(' ni ')}.${lista}` };
    }

    // Stock imposible: el bot no puede prometer lo que no hay. Se revisa
    // ANTES de crear nada, porque un pedido creado ya es una promesa.
    const faltante = this.revisarStock(renglones, catalogo);
    if (faltante.detalle.length) {
      const handoff = await this.pasarAPersona({
        telefono,
        memoria,
        motivo: 'sin_stock',
        detalle: faltante.detalle.join('; '),
        nombrePerfil,
        texto
      });
      return {
        respuesta: [
          `${faltante.paraElCliente.join('\n')}.`,
          '',
          handoff.respuesta
        ].join('\n')
      };
    }

    // Se entendio: se borra la cuenta de fallos seguidos.
    memoria.limpiarFallos();

    const fechaEntrega = interpretarFecha(extraido.fecha_entrega) ?? undefined;

    // Aqui NO se crea el pedido, ni cuando el cliente dice "mandame 20 de
    // pechuga". Lo que sale de la IA es una lectura de un mensaje escrito a
    // prisa, y entre esa lectura y despachar pollo tiene que haber un cliente
    // viendo el total y diciendo que si. El pedido nace en `atenderConfirmacion`.
    return this.proponerBorrador({
      telefono,
      memoria,
      renglones,
      // El catalogo ya esta leido para resolver nombres y revisar stock: se
      // reusa para poner los precios, sin volver a pedir la misma tabla.
      catalogo,
      encabezado: traeSaludo ? `${saludo}! Le sale asi:` : 'Le sale asi:',
      fechaEntrega,
      notas: extraido.notas ?? undefined,
      noEncontrados,
      nombrePerfil,
      texto
    });
  },

  /**
   * Cuantos kilos de los pedidos no alcanzan con el stock de hoy.
   *
   * No se rechaza por faltar un kilo: casi siempre entra mas mercancia antes
   * de la entrega y frenar por eso perderia ventas. Se escala solo cuando la
   * diferencia es grande — pedir 300 kg cuando hay 40 no se resuelve con un
   * "puede que no tengamos todo".
   */
  revisarStock(
    renglones: Renglon[],
    catalogo: Awaited<ReturnType<typeof productosService.findAll>>
  ): { detalle: string[]; paraElCliente: string[] } {
    const porId = new Map(catalogo.map((p) => [p.id, p]));
    const detalle: string[] = [];
    const paraElCliente: string[] = [];

    for (const r of renglones) {
      const prod = porId.get(r.producto_id);
      if (!prod) continue;
      const disponible = Number(prod.stock_actual);

      if (r.kg > disponible * FACTOR_STOCK_INSUFICIENTE && r.kg - disponible > MARGEN_KG_TOLERADO) {
        detalle.push(`${prod.nombre}: piden ${formatKg(r.kg)} y hay ${formatKg(disponible)}`);
        // Al cliente se le dice la cantidad REAL. Un "no tenemos suficiente"
        // sin numero lo deja sin poder decidir; con el numero puede pedir lo
        // que si hay y cerrar la venta hoy.
        paraElCliente.push(
          `${prod.nombre}: solo tenemos ${formatKg(disponible)} para entrega inmediata`
        );
      }
    }

    return { detalle, paraElCliente };
  },

  /**
   * El bot no entendio.
   *
   * A la tercera seguida deja de intentarlo. Por muchas reglas que se
   * escriban siempre habra una forma de escribir que no previmos, y un
   * cliente atrapado en un bucle de "no le entendi" educado termina yendose
   * con la competencia sin que nadie se entere.
   */
  async noEntendi(
    telefono: string,
    memoria: Memoria,
    texto: string,
    nombrePerfil: string | undefined,
    saludo: string
  ): Promise<Atencion> {
    const seguidos = memoria.contarFallo();

    if (seguidos >= 3) {
      return this.pasarAPersona({
        telefono,
        memoria,
        motivo: 'no_entendido',
        detalle: `${seguidos} mensajes seguidos sin entender`,
        nombrePerfil,
        texto
      });
    }

    return {
      respuesta: `${saludo}! No alcance a identificar el pedido. Digame el corte y los kilos, por ejemplo: "20 kilos de pechuga".`
    };
  },

  // ── Piezas compartidas ────────────────────────────────────────────────

  /**
   * Crea el pedido, con la ultima red contra los duplicados.
   *
   * Es el unico punto del modulo donde nace un pedido, y solo se llega aqui
   * desde un "si" del cliente. La red de duplicados sigue haciendo falta: dos
   * "si" muy seguidos llegan como dos mensajes distintos, y el segundo ya no
   * encuentra el borrador pero si podria encontrar el camino hasta aqui.
   */
  async crearPedido(params: {
    telefono: string;
    memoria: Memoria;
    nombrePerfil?: string;
    renglones: Renglon[];
    catalogo?: Awaited<ReturnType<typeof productosService.findAll>>;
    fechaEntrega?: string;
    notas?: string;
    saludo: string | null;
  }): Promise<Atencion> {
    const { telefono, memoria, nombrePerfil, renglones, fechaEntrega, notas, saludo } = params;
    const firma = firmaPedido(renglones);

    const repetido = memoria.pedidoDuplicado(firma);
    if (repetido) {
      return {
        respuesta: `Ese pedido ya me lo habia anotado, no se preocupe. Se lo repito:\n\n${repetido}`
      };
    }

    try {
      const { pedido, warnings } = await pedidosService.createOrder({
        cliente: { telefono, nombre: nombrePerfil },
        fecha_entrega: fechaEntrega,
        origen: 'whatsapp',
        notas,
        productos: renglones,
        catalogo: params.catalogo
      });

      let resumen = componerResumen(pedido, warnings, saludo);

      // El pedido se toma igual fuera de horario; solo se avisa. Rechazarlo
      // por la hora seria regalar la venta a quien escribe de noche.
      const fueraDeHorario = await this.avisoFueraDeHorario();
      if (fueraDeHorario) resumen = `${resumen}\n\n${fueraDeHorario}`;

      memoria.recordarPedido(firma, resumen);
      return { respuesta: resumen, pedidoId: pedido.id };
    } catch (e) {
      const detalle = e instanceof Error ? e.message : 'Error desconocido';
      console.error('[whatsapp] no se pudo crear el pedido:', detalle);
      return {
        respuesta: 'No pude registrar tu pedido en este momento. Intenta de nuevo en un rato.'
      };
    }
  },

  /**
   * Propone un borrador: lo guarda, vigila la indecision y lo escribe.
   *
   * Todos los caminos que cotizan pasan por aqui — la IA, el numero suelto,
   * "lo de siempre" y las correcciones. Tener un solo sitio es lo que
   * garantiza que ninguno se salte el conteo de cambios ni el "todavia no lo
   * anoto" del final: un camino que se lo saltara volveria a ser un pedido
   * creado sin que el cliente lo confirme.
   */
  async proponerBorrador(params: {
    telefono: string;
    memoria: Memoria;
    renglones: Renglon[];
    catalogo: Awaited<ReturnType<typeof productosService.findAll>>;
    encabezado: string;
    fechaEntrega?: string;
    notas?: string;
    noEncontrados?: string[];
    nombrePerfil?: string;
    texto?: string;
  }): Promise<Atencion> {
    const { telefono, memoria, renglones, catalogo } = params;

    const cambios = memoria.recordarCotizacion(renglones, {
      fechaEntrega: params.fechaEntrega,
      notas: params.notas
    });

    // Cambiar de opinion una y otra vez sin cerrar no lo resuelve otra
    // cotizacion mas: lo resuelve alguien que le ayude a decidir.
    if (cambios >= MAX_CAMBIOS_BORRADOR) {
      memoria.olvidarCotizacion();
      const handoff = await this.pasarAPersona({
        telefono,
        memoria,
        motivo: 'modificacion',
        detalle: `${cambios} cambios al pedido sin llegar a confirmarlo`,
        nombrePerfil: params.nombrePerfil,
        texto: params.texto
      });
      return {
        respuesta: `Para no equivocarme con los cambios, mejor lo vemos con calma. ${handoff.respuesta}`
      };
    }

    return {
      respuesta: this.armarCotizacion(renglones, catalogo, params.encabezado, {
        fechaEntrega: params.fechaEntrega,
        noEncontrados: params.noEncontrados
      })
    };
  },

  /**
   * El borrador escrito para que el cliente lo lea y diga que si.
   *
   * Solo formatea: guardar el borrador es cosa de quien llama, porque hay
   * caminos que necesitan saber cuantas veces se cambio antes de decidir si
   * vale la pena mandarlo. Que exista un unico formateador es lo que hace que
   * el cliente vea siempre la misma forma, venga el borrador de la IA, de un
   * "20" suelto o de un "lo de siempre".
   */
  armarCotizacion(
    renglones: Renglon[],
    catalogo: Awaited<ReturnType<typeof productosService.findAll>>,
    encabezado: string,
    extra?: { fechaEntrega?: string; noEncontrados?: string[] }
  ): string {
    const porId = new Map(catalogo.map((p) => [p.id, p]));
    const lineas = [encabezado, ''];
    let total = 0;
    let kilos = 0;

    for (const r of renglones) {
      const prod = porId.get(r.producto_id);
      if (!prod) continue;
      const sub = r.kg * Number(prod.precio_kg);
      total += sub;
      kilos += r.kg;
      lineas.push(`  ${formatKg(r.kg)} de ${prod.nombre} — ${formatCurrency(sub)}`);
    }

    lineas.push('');
    lineas.push(`Total: ${formatKg(kilos)} — ${formatCurrency(total)}`);

    if (extra?.fechaEntrega) lineas.push(`Entrega: ${extra.fechaEntrega}`);

    if (extra?.noEncontrados?.length) {
      lineas.push('');
      lineas.push(
        `Disculpe, no manejamos ${extra.noEncontrados.join(' ni ')}, por eso no va en la cuenta.`
      );
    }

    lineas.push('');
    lineas.push(PIDE_CONFIRMACION);
    return lineas.join('\n');
  },

  /** Los pedidos recientes de un telefono, del mas nuevo al mas viejo. */
  async pedidosDelCliente(telefono: string, limite: number): Promise<PedidoDelCliente[]> {
    const cliente = await clientesService.findByPhone(telefono);
    if (!cliente) return [];

    const { data, error } = await supabase
      .from('pedidos')
      .select('*, pedido_detalles(*, productos(*))')
      .eq('cliente_id', cliente.id)
      .order('created_at', { ascending: false })
      .limit(limite);

    if (error) {
      console.error('[whatsapp] no se pudieron leer los pedidos:', error.message);
      return [];
    }

    return (data ?? []) as PedidoDelCliente[];
  },

  /** Catalogo con precios reales. Se arma de la base, sin IA. */
  async armarCatalogo(
    saludo: string,
    catalogo?: Awaited<ReturnType<typeof productosService.findAll>>
  ): Promise<string> {
    const productos = (catalogo ?? (await productosService.findAll())).filter((p) => p.activo);
    if (!productos.length) return `${saludo}. En este momento no tengo productos disponibles.`;

    const lineas = [`${saludo}! Esto es lo que manejamos hoy:`, ''];
    for (const p of productos) {
      lineas.push(`  ${p.nombre} — ${formatCurrency(p.precio_kg)} el kilo`);
    }
    lineas.push('');
    lineas.push('Digame que se lleva y cuantos kilos.');
    return lineas.join('\n');
  },

  /**
   * Contesta cuanto cuesta un corte. El precio esta en la base: preguntarselo
   * a la IA seria gastar una peticion en un dato que ya esta en la base, con el riesgo
   * de que lo invente.
   */
  async armarPrecio(texto: string, saludo: string): Promise<string> {
    const catalogo = await productosService.findAll();
    const match = buscarProducto(texto, catalogo);

    if (match.encontrado) {
      const p = match.producto;
      return `${saludo}! El kilo de ${p.nombre} esta en ${formatCurrency(p.precio_kg)}. Cuantos kilos le mando?`;
    }

    // Se le pasa el catalogo ya leido: si no, la caida a "mandar la lista
    // completa" volvia a consultar la misma tabla en el mismo mensaje.
    return this.armarCatalogo(saludo, catalogo);
  },

  /** Horario desde la configuracion del negocio, sin IA. */
  async armarHorario(saludo: string): Promise<string> {
    const config = await configuracionService.getCurrent();
    return `${saludo}! Atendemos de ${config.horario_apertura} a ${config.horario_cierre}. Digame en que le puedo ayudar.`;
  },

  /**
   * Aviso de que el pedido entra fuera de horario.
   *
   * NO bloquea nada: el pedido se toma igual. Un cliente que escribe a las
   * once de la noche esta comprando, y rechazarlo por la hora seria regalar la
   * venta. Lo unico que hace falta es que no se quede esperando una entrega
   * que no va a salir hasta mañana.
   *
   * El texto sale de `configuracion_empresa.mensaje_fuera_horario`, que existia
   * en la base desde el principio y no lo usaba nadie.
   */
  async avisoFueraDeHorario(): Promise<string | null> {
    try {
      const config = await configuracionService.getCurrent();
      const aviso = config.mensaje_fuera_horario?.trim();
      if (!aviso) return null;

      const ahora = new Intl.DateTimeFormat('es-MX', {
        timeZone: 'America/Mexico_City',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(new Date());

      const t = aMinutos(ahora);
      const abre = aMinutos(config.horario_apertura);
      const cierra = aMinutos(config.horario_cierre);

      // Si el cierre es menor que la apertura, el turno cruza la medianoche
      // (por ejemplo 22:00 a 06:00) y la comparacion se invierte.
      const abierto = abre <= cierra ? t >= abre && t < cierra : t >= abre || t < cierra;

      return abierto ? null : aviso;
    } catch (e) {
      // Sin configuracion legible se prefiere no decir nada: un aviso
      // equivocado de horario confunde mas que la ausencia de aviso.
      console.error('[whatsapp] no se pudo revisar el horario:', e instanceof Error ? e.message : e);
      return null;
    }
  },

  async responder(telefono: string, texto: string, mensajeOrigenId?: string): Promise<void> {
    const envio = await enviarMensaje(telefono, texto);

    // Las dos escrituras no dependen entre si: guardar lo que dijo el bot y
    // marcar como atendido el mensaje del cliente son hechos independientes.
    // En serie se pagaban dos viajes de red donde cabe uno.
    await Promise.all([
      supabase.from('mensajes_whatsapp').insert({
        telefono,
        mensaje: texto,
        tipo: 'bot',
        wa_message_id: envio.wamid ?? null,
        procesado: envio.enviado,
        error: envio.error ?? null
      }),
      mensajeOrigenId
        ? supabase.from('mensajes_whatsapp').update({ procesado: true }).eq('id', mensajeOrigenId)
        : Promise.resolve()
    ]);
  }
};

/**
 * Que contestar a lo que no es texto.
 *
 * Groq lee texto, punto: un audio o una foto no se pueden procesar. Lo que si
 * se puede es no hacer sentir tonto al cliente y decirle exactamente que
 * hacer, porque un "no entiendo" seco hace que reenvie el mismo audio.
 */
function respuestaParaNoTexto(tipo: string): string {
  const cierre = 'Escribame por texto que corte necesita y cuantos kilos, y se lo anoto en seguida.';

  switch (tipo) {
    case 'audio':
    case 'voice':
      return `Disculpe, por aqui todavia no puedo escuchar notas de voz. ${cierre}`;
    case 'image':
    case 'video':
    case 'document':
      return `Disculpe, por aqui todavia no puedo ver imagenes ni archivos. ${cierre}`;
    case 'sticker':
      // Un sticker no es una pregunta: se contesta corto y sin regañar.
      return `Aqui andamos! ${cierre}`;
    case 'location':
      return `Gracias por la ubicacion. La entrega la coordina una persona, en un momento le contesta. Si quiere ir adelantando el pedido, ${cierre.toLowerCase()}`;
    default:
      return `Por ahora solo puedo leer mensajes de texto. ${cierre}`;
  }
}

/**
 * El acuse del pedido ya creado.
 *
 * El cliente acaba de decir que si, asi que la primera linea confirma que se
 * anoto — no repetir esa confirmacion es lo que hace que vuelva a escribir
 * "quedo?" cinco minutos despues.
 *
 * Y cierra diciendo que falta el visto bueno del negocio, porque es verdad: el
 * pedido nace en estado pendiente y el stock todavia no se movio. Callarlo
 * haria que el cliente cuente con mercancia que nadie ha apartado.
 */
type PedidoResumen = {
  id: string;
  total_kg: number | string;
  total_precio: number | string;
  fecha_entrega: string | null;
  pedido_detalles?: Array<{
    kg: number | string;
    productos?: { nombre?: string } | null;
  }>;
};

function componerResumen(
  pedido: PedidoResumen,
  warnings: string[],
  saludo: string | null
): string {
  // Si el cliente saludo, se le devuelve el saludo: cuesta cero y cambia por
  // completo como se siente el trato.
  const lineas: string[] = saludo
    ? [`${saludo}! Listo, ya se lo anote:`]
    : ['Listo, ya se lo anote:'];

  for (const d of pedido.pedido_detalles ?? []) {
    lineas.push(`  ${formatKg(d.kg)} de ${d.productos?.nombre ?? 'producto'}`);
  }

  lineas.push('');
  lineas.push(`Total: ${formatKg(pedido.total_kg)} — ${formatCurrency(pedido.total_precio)}`);

  if (pedido.fecha_entrega) {
    lineas.push(`Entrega: ${pedido.fecha_entrega}`);
  }

  const stock = warnings.filter((w) => w.toLowerCase().includes('stock'));
  const otros = warnings.filter((w) => !w.toLowerCase().includes('stock'));

  if (stock.length) {
    lineas.push('');
    lineas.push('Puede que no tengamos todo lo que pidio; se lo confirmamos en un momento.');
  }

  if (otros.length) {
    lineas.push('');
    for (const w of otros) lineas.push(w);
  }

  lineas.push('');
  lineas.push('Queda anotado. En cuanto le demos salida en el mostrador le avisamos.');

  return lineas.join('\n');
}
