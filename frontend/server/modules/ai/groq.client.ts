import { env } from '../../config/env';

type GroqChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export const isGroqConfigured = (): boolean => Boolean(env.groqApiKey);

export const createGroqChatCompletion = async (
  messages: GroqChatMessage[]
): Promise<string> => {
  if (!env.groqApiKey) {
    throw new Error('Groq no configurado');
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Error de Groq: ${response.status} ${detail}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return payload.choices?.[0]?.message?.content ?? '';
};
