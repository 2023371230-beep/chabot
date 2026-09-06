import './cargar-env';
import { createClient } from '@supabase/supabase-js';
const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
const pub = createClient(process.env.SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
const CORREO = 'verificacion.ui@bascula.local', CLAVE = 'Verifica!2026#ui';
(async () => {
  await admin.auth.admin.createUser({ email: CORREO, password: CLAVE, email_confirm: true });
  const { data } = await pub.auth.signInWithPassword({ email: CORREO, password: CLAVE });
  console.log(JSON.stringify({ access_token: data.session?.access_token, refresh_token: data.session?.refresh_token, expires_in: data.session?.expires_in, user: data.session?.user }));
  process.exit(0);
})();
