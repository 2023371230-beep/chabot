import dotenv from 'dotenv';

dotenv.config();

const required = (name: string): string => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  supabaseUrl: required('SUPABASE_URL'),
  supabaseSecretKey: required('SUPABASE_SECRET_KEY'),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  // A donde apuntan los enlaces de las alertas. En local es el mismo
  // frontend; en produccion es el dominio de Vercel.
  dashboardUrl: process.env.DASHBOARD_URL ?? process.env.FRONTEND_URL ?? 'http://localhost:3000',
  groqApiKey: process.env.GROQ_API_KEY,
  groqModel: process.env.GROQ_MODEL ?? 'openai/gpt-oss-20b',

  // WhatsApp Cloud API.
  //
  // Ninguna es `required`: el dashboard tiene que poder arrancar sin WhatsApp
  // configurado. Cada punto de uso valida lo que necesita y falla con un
  // mensaje que dice que variable falta, en vez de tumbar el servidor entero
  // al importar este archivo.
  whatsapp: {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    wabaId: process.env.WHATSAPP_WABA_ID,
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
    apiVersion: process.env.WHATSAPP_API_VERSION ?? 'v25.0',
    // Secreto de la app de Meta. Sirve para verificar la firma
    // X-Hub-Signature-256 y comprobar que el webhook viene de Meta y no de
    // cualquiera que descubrio la URL de ngrok.
    appSecret: process.env.WHATSAPP_APP_SECRET,
    // Celular del encargado, para avisarle cuando un chat necesita a una
    // persona. Opcional: sin el, el aviso vive solo en el dashboard.
    alertaNumero: process.env.WHATSAPP_ALERTA_NUMERO
  }
};

export const isProduction = env.nodeEnv === 'production';

/** Para MANDAR mensajes hacen falta el token y el id del numero. */
export const isWhatsappSendConfigured = (): boolean =>
  Boolean(env.whatsapp.accessToken && env.whatsapp.phoneNumberId);

/** Para RECIBIR el webhook basta con el token de verificacion. */
export const isWhatsappWebhookConfigured = (): boolean =>
  Boolean(env.whatsapp.verifyToken);
