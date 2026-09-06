import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

export const supabase = createClient(env.supabaseUrl, env.supabaseSecretKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

/**
 * Codigo de PostgreSQL para violacion de restriccion unica.
 *
 * Vive aqui porque lo consultan dos modulos que no se conocen entre si: la
 * deduplicacion de mensajes por `wa_message_id` y la creacion de la
 * conversacion. Estaba nombrado en uno y escrito a pelo en el otro.
 */
export const DUPLICADO = '23505';
