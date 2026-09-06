import { env } from '../../config/env';

type GroqChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export const isGroqConfigured = (): boolean => Boolean(env.groqApiKey);

/**
 * Cuanto se espera a Groq antes de rendirse.
 *
 * Una extraccion normal tarda ~1.5 s. Sin este tope, un mal dia de Groq deja
 * la peticion colgada hasta que Vercel corta la funcion a los 30 s: el cliente
 * se queda mirando WhatsApp sin respuesta medio minuto, y se paga ese
 * tiempo de ejecucion. Doce segundos son de sobra para el peor caso normal.
 */
const ESPERA_MAXIMA_MS = 12_000;

export const createGroqChatCompletion = async (
  messages: GroqChatMessage[]
): Promise<string> => {
  if (!env.groqApiKey) {
    throw new Error('Groq no configurado');
  }

  let response: Response;
  try {
    response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.groqApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: env.groqModel,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages
      }),
      signal: AbortSignal.timeout(ESPERA_MAXIMA_MS)
    });
  } catch (error) {
    // Un timeout aborta con TimeoutError. Se distingue de un fallo de red
    // porque quien llama decide distinto: ante lentitud conviene pasar el
    // chat a una persona, no pedirle al cliente que reescriba su pedido.
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new Error(`Groq no respondio en ${ESPERA_MAXIMA_MS / 1000} s`);
    }
    throw error;
  }

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Error de Groq: ${response.status} ${detail}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return payload.choices?.[0]?.message?.content ?? '';
};
