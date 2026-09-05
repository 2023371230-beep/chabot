import { supabase } from '../../database/supabase.client';
import { aiService } from '../ai/ai.service';
import { clientesService } from '../clientes/clientes.service';
import { pedidosService } from '../pedidos/pedidos.service';
import { productosService } from '../productos/productos.service';
import { formatCurrency, formatKg } from '../../shared/utils/format.utils';
import { buscarProducto, interpretarFecha } from './whatsapp.matcher';
import { clasificar, saludoPorHora, MAX_CARACTERES_IA } from './whatsapp.intents';
import { configuracionService } from '../configuracion/configuracion.service';
import { enviarMensaje, marcarComoLeido } from './whatsapp.client';
import { puedeUsarIA, registrarUso } from './whatsapp.presupuesto';
import { pausar, type MotivoHandoff } from './whatsapp.handoff';
import { firmaPedido, Memoria, type Renglon } from './whatsapp.memoria';
import {
  esSoloEstados,
  extraerMensajes,
  type MensajeEntrante,
  type MetaWebhookPayload
} from './whatsapp.types';

/** Codigo de PostgreSQL para violacion de restriccion unica. */
const DUPLICADO = '23505';

/**
 * Tope de kilos por renglon antes de dudar.
 *
 * Un pedido de mayoreo grande son 200 o 300 kilos. Arriba de 500 casi siempre
 * es un dedazo ("2000" en vez de "200") o la IA leyendo mal un numero de
 * telefono. Despachar eso vacia el almacen, asi que se pregunta.
 */
const MAX_KG_RAZONABLE = 500;

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
    // Contestar cada emoji es ruido para el cliente y trabajo para nosotros.
    if (!respuesta) {
      await supabase.from('mensajes_whatsapp').update({ procesado: true }).eq('id', guardado.id);
      return { ...base, procesado: true, motivo: 'Sin respuesta necesaria' };
    }

    await this.responder(mensaje.telefono, respuesta, guardado.id);
    return { ...base, procesado: true, respuesta, pedidoId };
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
    // 0. Si una persona ya tomo este chat, el bot se calla. Contestar por
    //    debajo del asesor haria que el cliente vea dos voces distintas
    //    diciendo cosas distintas en la misma conversacion.
    // La memoria se lee UNA vez por mensaje. Esa misma lectura contesta si el
    // chat esta pausado, asi que no cuesta una consulta aparte.
    const memoria = await Memoria.cargar(telefono);

    if (memoria.pausada) return { respuesta: '' };

    // 1. El cliente reenvio el mismo texto porque no vio la palomita. Se le
    //    repite lo que ya se le contesto en vez de procesarlo otra vez.
    const yaContestado = memoria.respuestaRepetida(texto);
    if (yaContestado) return { respuesta: yaContestado };

    const resultado = await this.decidir(texto, telefono, memoria, nombrePerfil);
    if (resultado.respuesta) memoria.recordarRespuesta(texto, resultado.respuesta);

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
      motivo: params.motivo,
      detalle: params.detalle,
      nombreCliente: params.nombrePerfil,
      ultimoMensaje: params.texto
    });
    return { respuesta };
  },

  async decidir(
    texto: string,
    telefono: string,
    memoria: Memoria,
    nombrePerfil?: string
  ): Promise<Atencion> {
    const intencion = clasificar(texto);
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
        return { respuesta: await this.atenderCancelacion(telefono) };

      case 'modificacion':
        return this.atenderModificacion(telefono, memoria, nombrePerfil, texto);

      case 'estado_pedido':
        return { respuesta: await this.atenderEstado(telefono) };

      case 'confirmacion':
        return this.atenderConfirmacion(telefono, memoria, nombrePerfil);

      case 'rechazo':
        memoria.olvidarCotizacion();
        return { respuesta: 'Sin problema. Aqui andamos por si se anima mas tarde.' };

      case 'repetir':
        return { respuesta: await this.atenderRepetir(telefono, memoria, saludo) };

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
  async atenderCancelacion(telefono: string): Promise<string> {
    const pedidos = await this.pedidosDelCliente(telefono, 3);
    const ultimo = pedidos[0];

    if (!ultimo) {
      return 'No encuentro ningun pedido suyo abierto. Si quiere hacer uno, digame el corte y los kilos.';
    }

    if (ultimo.estado === 'cancelado') {
      return 'Ese pedido ya estaba cancelado. No se preocupe, no se le va a cobrar nada.';
    }

    if (ultimo.estado !== 'pendiente') {
      return `Su pedido de ${formatKg(ultimo.total_kg)} ya esta ${ultimo.estado} y ya se preparo. Le paso el caso al encargado para ver como le ayudamos.`;
    }

    try {
      await pedidosService.updateOrderStatus(ultimo.id, 'cancelado');
      return `Listo, cancele su pedido de ${formatKg(ultimo.total_kg)} por ${formatCurrency(ultimo.total_precio)}. No se le cobra nada. Cuando guste hacemos otro.`;
    } catch (e) {
      console.error('[whatsapp] no se pudo cancelar:', e instanceof Error ? e.message : e);
      return 'No pude cancelarlo automaticamente. Ya le avise al encargado para que lo haga en este momento.';
    }
  },

  /**
   * "Mejor que sean 30 y no 20".
   *
   * Cambiar un pedido existente por WhatsApp es donde mas facil se duplica el
   * pollo: si esto llegara a la IA, extraeria "30 kilos" y crearia un SEGUNDO
   * pedido encima del de 20. Se le muestra al cliente lo que tiene y se pasa a
   * una persona.
   */
  async atenderModificacion(
    telefono: string,
    memoria: Memoria,
    nombrePerfil?: string,
    texto?: string
  ): Promise<Atencion> {
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
   * "Si, apartamelo" despues de una cotizacion.
   *
   * Se crea el pedido con los renglones que YA se habian resuelto al cotizar:
   * ni una peticion de IA mas, y cero riesgo de que el modelo entienda otra
   * cosa la segunda vez.
   */
  async atenderConfirmacion(
    telefono: string,
    memoria: Memoria,
    nombrePerfil?: string
  ): Promise<Atencion> {
    const cotizacion = memoria.tomarCotizacion();

    if (!cotizacion) {
      // Un "va" o un "sale" sueltos son solo un acuse de recibo.
      return { respuesta: 'Perfecto. Cualquier cosa aqui ando.' };
    }

    return this.crearPedido({
      telefono,
      memoria,
      nombrePerfil,
      renglones: cotizacion.renglones,
      fechaEntrega: cotizacion.fechaEntrega,
      saludo: null
    });
  },

  /** "Lo de siempre": se lee el ultimo pedido en vez de inventarlo. */
  async atenderRepetir(telefono: string, memoria: Memoria, saludo: string): Promise<string> {
    const [ultimo] = await this.pedidosDelCliente(telefono, 1);

    if (!ultimo?.pedido_detalles?.length) {
      return `${saludo}! Todavia no tengo un pedido anterior suyo. Digame que corte necesita y cuantos kilos.`;
    }

    const renglones: Renglon[] = ultimo.pedido_detalles.map((d) => ({
      producto_id: d.producto_id,
      kg: Number(d.kg)
    }));

    // Se cotiza y se pregunta. El "si" del cliente lo convierte en pedido sin
    // gastar IA, porque los renglones ya quedaron guardados.
    memoria.recordarCotizacion(renglones);

    const lineas = [`${saludo}! Su ultimo pedido fue:`, ''];
    for (const d of ultimo.pedido_detalles) {
      lineas.push(`  ${formatKg(d.kg)} de ${d.productos?.nombre ?? 'producto'}`);
    }
    lineas.push('');
    lineas.push('Se lo repito igual?');
    return lineas.join('\n');
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

    return this.crearPedido({
      telefono,
      memoria,
      nombrePerfil,
      renglones: [{ producto_id: pendiente.producto_id, kg: valor }],
      saludo: null
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
    // fallar. El cliente no tiene por que enterarse de nuestros limites.
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

    // "Cuanto cuesta 20 kilos de pechuga" es una COTIZACION, no un pedido.
    // Crear el pedido aqui seria presumir que ya compro.
    const soloCotiza = extraido.intent === 'consulta';

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

    if (soloCotiza) {
      return {
        respuesta: this.armarCotizacion(memoria, renglones, catalogo, saludo, fechaEntrega)
      };
    }

    return this.crearPedido({
      telefono,
      memoria,
      nombrePerfil,
      renglones,
      fechaEntrega,
      notas: extraido.notas ?? undefined,
      noEncontrados,
      saludo: traeSaludo ? saludo : null
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

      // No se frena por faltar un kilo: casi siempre entra mercancia antes de
      // la entrega y rechazar por eso perderia ventas. Se escala cuando la
      // diferencia es grande de verdad — pedir 80 habiendo 30 no se arregla
      // con un "puede que no tengamos todo".
      if (r.kg > disponible * 2 && r.kg - disponible > 20) {
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
   * El cliente que no ve respuesta reescribe su pedido con otras palabras. La
   * cache de texto identico no lo agarra porque el texto cambio, pero los
   * renglones resueltos son los mismos: esa huella es la que se compara.
   */
  async crearPedido(params: {
    telefono: string;
    memoria: Memoria;
    nombrePerfil?: string;
    renglones: Renglon[];
    fechaEntrega?: string;
    notas?: string;
    noEncontrados?: string[];
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
        productos: renglones
      });

      const resumen = componerResumen(pedido, warnings, params.noEncontrados ?? [], saludo);
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
   * Cotiza y se acuerda de lo que cotizo.
   *
   * Guardar los renglones es lo que permite que un "si porfa" se convierta en
   * pedido sin volver a molestar a la IA.
   */
  armarCotizacion(
    memoria: Memoria,
    renglones: Renglon[],
    catalogo: Awaited<ReturnType<typeof productosService.findAll>>,
    saludo: string,
    fechaEntrega?: string
  ): string {
    memoria.recordarCotizacion(renglones, fechaEntrega);

    const porId = new Map(catalogo.map((p) => [p.id, p]));
    const lineas = [`${saludo}! Le sale asi:`, ''];
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
    lineas.push('');
    lineas.push('Se lo aparto?');
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
  async armarCatalogo(saludo: string): Promise<string> {
    const productos = (await productosService.findAll()).filter((p) => p.activo);
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
   * a la IA seria gastar una peticion en un dato que ya tenemos, con el riesgo
   * de que lo invente.
   */
  async armarPrecio(texto: string, saludo: string): Promise<string> {
    const catalogo = await productosService.findAll();
    const match = buscarProducto(texto, catalogo);

    if (match.encontrado) {
      const p = match.producto;
      return `${saludo}! El kilo de ${p.nombre} esta en ${formatCurrency(p.precio_kg)}. Cuantos kilos le mando?`;
    }

    return this.armarCatalogo(saludo);
  },

  /** Horario desde la configuracion del negocio, sin IA. */
  async armarHorario(saludo: string): Promise<string> {
    const config = await configuracionService.getCurrent();
    return `${saludo}! Atendemos de ${config.horario_apertura} a ${config.horario_cierre}. Digame en que le puedo ayudar.`;
  },

  async responder(telefono: string, texto: string, mensajeOrigenId?: string): Promise<void> {
    const envio = await enviarMensaje(telefono, texto);

    await supabase.from('mensajes_whatsapp').insert({
      telefono,
      mensaje: texto,
      tipo: 'bot',
      wa_message_id: envio.wamid ?? null,
      procesado: envio.enviado,
      error: envio.error ?? null
    });

    if (mensajeOrigenId) {
      await supabase
        .from('mensajes_whatsapp')
        .update({ procesado: true })
        .eq('id', mensajeOrigenId);
    }
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
 * El mensaje de vuelta al cliente.
 *
 * Cierra siempre diciendo que el pedido esta POR CONFIRMAR: es la unica forma
 * de que el cliente no asuma que ya esta apartado. El stock no se movio.
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
  noEncontrados: string[],
  saludo: string | null
): string {
  // Si el cliente saludo, se le devuelve el saludo: cuesta cero y cambia por
  // completo como se siente el trato.
  const lineas: string[] = saludo ? [`${saludo}! Con gusto. Le anote:`] : ['Con gusto. Le anote:'];

  for (const d of pedido.pedido_detalles ?? []) {
    lineas.push(`  ${formatKg(d.kg)} de ${d.productos?.nombre ?? 'producto'}`);
  }

  lineas.push('');
  lineas.push(`Total: ${formatKg(pedido.total_kg)} — ${formatCurrency(pedido.total_precio)}`);

  if (pedido.fecha_entrega) {
    lineas.push(`Entrega: ${pedido.fecha_entrega}`);
  }

  if (noEncontrados.length) {
    lineas.push('');
    lineas.push(`Disculpe, no manejamos ${noEncontrados.join(' ni ')}, por eso no va en el pedido.`);
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
  lineas.push('Su pedido queda POR CONFIRMAR. En cuanto lo confirmemos le avisamos.');

  return lineas.join('\n');
}
