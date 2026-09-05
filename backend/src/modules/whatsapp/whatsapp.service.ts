import { supabase } from '../../database/supabase.client';
import { aiService } from '../ai/ai.service';
import { pedidosService } from '../pedidos/pedidos.service';
import { productosService } from '../productos/productos.service';
import { formatCurrency, formatKg } from '../../shared/utils/format.utils';
import { buscarProducto, interpretarFecha } from './whatsapp.matcher';
import { enviarMensaje, marcarComoLeido } from './whatsapp.client';
import {
  esSoloEstados,
  extraerMensajes,
  type MensajeEntrante,
  type MetaWebhookPayload
} from './whatsapp.types';

/** Codigo de PostgreSQL para violacion de restriccion unica. */
const DUPLICADO = '23505';

type ResultadoMensaje = {
  wamid: string;
  telefono: string;
  procesado: boolean;
  motivo?: string;
  respuesta?: string;
  pedidoId?: string;
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

    if (mensaje.tipo !== 'text' || !mensaje.texto) {
      const r = 'Por ahora solo leo mensajes de texto. Escribeme que necesitas y cuantos kilos.';
      await this.responder(mensaje.telefono, r, guardado.id);
      return { ...base, procesado: true, motivo: 'Tipo no soportado', respuesta: r };
    }

    // 2. El flujo de negocio.
    const { respuesta, pedidoId } = await this.atender(
      mensaje.texto,
      mensaje.telefono,
      mensaje.nombrePerfil
    );
    await this.responder(mensaje.telefono, respuesta, guardado.id);
    return { ...base, procesado: true, respuesta, pedidoId };
  },

  /**
   * Del texto del cliente al pedido creado.
   *
   * La IA SOLO extrae datos: que producto y cuantos kilos. No decide precios,
   * no valida stock, no aplica el limite de mayoreo. Todo eso lo resuelve
   * `pedidosService.createOrder`, que es la misma ruta que usa el dashboard.
   * Asi las reglas viven en un solo lugar y no se pueden contradecir.
   */
  async atender(
    texto: string,
    telefono: string,
    nombrePerfil?: string
  ): Promise<{ respuesta: string; pedidoId?: string }> {
    let extraido;
    try {
      const salida = await aiService.extractOrderFromMessage(texto);
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
        respuesta: 'No pude entender tu mensaje. Escribeme por ejemplo: "20 kilos de pechuga para el viernes".'
      };
    }

    if (extraido.intent === 'saludo') {
      return {
        respuesta:
          'Que tal. Dime que necesitas y cuantos kilos, por ejemplo: "15 kilos de pierna para manana".'
      };
    }

    if (extraido.intent !== 'pedido' || !extraido.productos.length) {
      return {
        respuesta:
          'No alcance a identificar un pedido. Dime el corte y los kilos, por ejemplo: "20 kilos de pechuga".'
      };
    }

    // 3. Traducir nombres a productos reales del catalogo.
    const catalogo = await productosService.findAll();
    const renglones: { producto_id: string; kg: number }[] = [];
    const noEncontrados: string[] = [];
    const sinCantidad: string[] = [];
    let sugerencias: string[] = [];

    for (const item of extraido.productos) {
      const match = buscarProducto(item.nombre_producto, catalogo);

      if (!match.encontrado) {
        noEncontrados.push(item.nombre_producto);
        sugerencias = match.sugerencias;
        continue;
      }
      if (!item.kg || item.kg <= 0) {
        sinCantidad.push(match.producto.nombre);
        continue;
      }
      renglones.push({ producto_id: match.producto.id, kg: item.kg });
    }

    // 4. Preguntar antes que adivinar.
    if (sinCantidad.length) {
      return {
        respuesta: `Cuantos kilos de ${sinCantidad.join(' y ')} necesitas?`
      };
    }

    if (!renglones.length) {
      const lista = sugerencias.length ? `\n\nTenemos: ${sugerencias.join(', ')}.` : '';
      return {
        respuesta: `No manejamos ${noEncontrados.join(' ni ')}.${lista}`
      };
    }

    // 5. Crear el pedido por la MISMA ruta que el dashboard.
    try {
      const { pedido, warnings } = await pedidosService.createOrder({
        cliente: { telefono, nombre: nombrePerfil },
        fecha_entrega: interpretarFecha(extraido.fecha_entrega) ?? undefined,
        origen: 'whatsapp',
        notas: extraido.notas ?? undefined,
        productos: renglones
      });

      return {
        respuesta: componerResumen(pedido, warnings, noEncontrados),
        pedidoId: pedido.id
      };
    } catch (e) {
      const detalle = e instanceof Error ? e.message : 'Error desconocido';
      console.error('[whatsapp] no se pudo crear el pedido:', detalle);
      return {
        respuesta: 'No pude registrar tu pedido en este momento. Intenta de nuevo en un rato.'
      };
    }
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

const componerSinStock = (warnings: string[]): string[] =>
  warnings.filter((w) => w.toLowerCase().includes('stock'));

const componerSinStockNi = (warnings: string[]): string[] =>
  warnings.filter((w) => !w.toLowerCase().includes('stock'));

function componerResumen(
  pedido: PedidoResumen,
  warnings: string[],
  noEncontrados: string[]
): string {
  const lineas: string[] = ['Anote tu pedido:'];

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
    lineas.push(`No manejamos ${noEncontrados.join(' ni ')}, por eso no va en el pedido.`);
  }

  const stock = componerSinStock(warnings);
  const otros = componerSinStockNi(warnings);

  if (stock.length) {
    lineas.push('');
    lineas.push('Puede que no tengamos todo lo que pediste; te confirmamos en un momento.');
  }

  if (otros.length) {
    lineas.push('');
    for (const w of otros) lineas.push(w);
  }

  lineas.push('');
  lineas.push('Queda POR CONFIRMAR. En cuanto lo confirmemos te avisamos.');

  return lineas.join('\n');
}
