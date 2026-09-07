/**
 * Crea (o borra) un usuario temporal para verificar la interfaz en el navegador.
 *
 * Existe porque la unica forma honesta de comprobar que el dashboard funciona
 * es entrar de verdad: la API exige sesion y mirar la pantalla de login no
 * prueba nada de lo que hay detras.
 *
 *   npx tsx scripts/sesion-de-prueba.ts crear
 *   npx tsx scripts/sesion-de-prueba.ts borrar
 */
import './cargar-env';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false }
});

const CORREO = 'verificacion.ui@bascula.local';
const CLAVE = 'Verifica!2026#ui';

const main = async (): Promise<void> => {
  const { data } = await admin.auth.admin.listUsers();
  const existente = data.users.find((u) => u.email === CORREO);

  if (process.argv[2] === 'crear') {
    if (existente) {
      console.log(`ya existia: ${CORREO} / ${CLAVE}`);
    } else {
      const { error } = await admin.auth.admin.createUser({
        email: CORREO,
        password: CLAVE,
        email_confirm: true
      });
      console.log(error ? `error: ${error.message}` : `creado: ${CORREO} / ${CLAVE}`);
    }
  } else {
    if (existente) {
      await admin.auth.admin.deleteUser(existente.id);
      console.log('borrado');
    } else {
      console.log('no existia');
    }
  }
  process.exit(0);
};

void main();
