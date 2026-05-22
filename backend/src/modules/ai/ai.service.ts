import { AppError } from '../../shared/errors/AppError';
import { createGroqChatCompletion, isGroqConfigured } from './groq.client';
import type { ExtractedOrder } from './ai.types';

const safeFallback = (message: string): ExtractedOrder => ({
  intent: message.trim() ? 'desconocido' : 'desconocido',
  productos: [],
  fecha_entrega: null,
  notas: message
});

const normalizeExtractedOrder = (
  value: unknown,
  originalMessage: string
): ExtractedOrder => {
  if (!value || typeof value !== 'object') {
    return safeFallback(originalMessage);
  }

  const record = value as Partial<ExtractedOrder>;
  const allowedIntents = ['pedido', 'consulta', 'queja', 'saludo', 'desconocido'];

  return {
    intent: allowedIntents.includes(String(record.intent))
      ? (record.intent as ExtractedOrder['intent'])
      : 'desconocido',
    productos: Array.isArray(record.productos)
      ? record.productos.map((producto) => ({
          nombre_producto: String(
            (producto as { nombre_producto?: unknown }).nombre_producto ?? ''
          ),
          kg:
            typeof (producto as { kg?: unknown }).kg === 'number'
              ? ((producto as { kg: number }).kg as number)
              : null
        }))
      : [],
    fecha_entrega: typeof record.fecha_entrega === 'string' ? record.fecha_entrega : null,
    notas: typeof record.notas === 'string' ? record.notas : null
  };
};

export const aiService = {
  async extractOrderFromMessage(message: string): Promise<{
    configured: boolean;
    result: ExtractedOrder;
  }> {
    if (!isGroqConfigured()) {
      return {
        configured: false,
        result: safeFallback(message)
      };
    }

    try {
      const content = await createGroqChatCompletion([
        {
          role: 'system',
          content:
            'Eres un extractor de pedidos avicolas. Convierte mensajes de clientes en JSON. No decidas precios, stock ni fechas. Solo extrae datos.'
        },
        {
          role: 'user',
          content: `Extrae JSON con esta forma exacta: {"intent":"pedido|consulta|queja|saludo|desconocido","productos":[{"nombre_producto":"string","kg":number|null}],"fecha_entrega":"string|null","notas":"string|null"}. Mensaje: ${message}`
        }
      ]);

      const parsed = JSON.parse(content) as unknown;

      return {
        configured: true,
        result: normalizeExtractedOrder(parsed, message)
      };
    } catch (error) {
      throw new AppError('No se pudo extraer el pedido con IA', 502, [error]);
    }
  }
};
