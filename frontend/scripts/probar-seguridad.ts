/**
 * Comprueba que la API sigue funcionando CON sesion valida.
 *
 * Crea un usuario temporal, inicia sesion, golpea la API con su token y borra
 * el usuario al terminar. Sin esta prueba, cerrar la API podria haber roto el
 * dashboard entero sin que nadie lo notara hasta el primer inicio de sesion.
 */
import './cargar-env';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL!;
const SECRET = process.env.SUPABASE_SECRET_KEY!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const BASE = process.argv[2] ?? 'http://localhost:3000';

const CORREO = `prueba.auth.${Date.now()}@bascula.local`;
const CLAVE = `Pr!${Math.random().toString(36).slice(2)}Ab9`;

const admin = createClient(URL, SECRET, { auth: { persistSession: false } });
const publico = createClient(URL, ANON, { auth: { persistSession: false } });

let ok = 0;
const fallas: string[] = [];
const revisar = (t: string, c: boolean, d = '') => {
  if (c) {
    ok += 1;
    console.log(`   OK   ${t}`);
  } else {
    fallas.push(t);
    console.log(`  FALLA ${t}${d ? ` -> ${d}` : ''}`);
  }
};

const main = async (): Promise<void> => {
  console.log('');
  console.log(`  API: ${BASE}`);
  console.log('  ' + '-'.repeat(62));

  const { data: creado, error: errCrear } = await admin.auth.admin.createUser({
    email: CORREO,
    password: CLAVE,
    email_confirm: true
  });
  if (errCrear || !creado.user) {
    console.error('  no se pudo crear el usuario de prueba:', errCrear?.message);
    process.exit(1);
  }
  const idUsuario = creado.user.id;

  try {
    const { data: sesion, error: errLogin } = await publico.auth.signInWithPassword({
      email: CORREO,
      password: CLAVE
    });
    revisar('el login devuelve una sesion', Boolean(sesion.session), errLogin?.message);

    const token = sesion.session?.access_token;
    if (!token) throw new Error('sin token');

    const rutas = [
      'pedidos',
      'productos',
      'clientes',
      'inventario/resumen',
      'configuracion',
      'whatsapp/handoffs'
    ];

    for (const r of rutas) {
      const res = await fetch(`${BASE}/api/${r}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      revisar(`GET /api/${r} con token`, res.status === 200, `HTTP ${res.status}`);
    }

    // El mismo token con la firma manipulada.
    //
    // Se toca un caracter del MEDIO de la firma, no el ultimo. La firma ES256
    // son 512 bits metidos en 86 caracteres base64url, que caben 516: los 4
    // bits sobrantes viven en el ULTIMO caracter y son relleno. Cambiar ahi
    // una 'a' por una 'b' solo mueve relleno, la firma decodifica a los mismos
    // 64 bytes y el token sigue siendo valido — la prueba fallaba de vez en
    // cuando por eso, no porque el sistema dejara pasar nada.
    const [cab, carga, firma] = token.split('.');
    const medio = Math.floor(firma.length / 2);
    const alterado = `${cab}.${carga}.${firma.slice(0, medio)}${
      firma[medio] === 'A' ? 'B' : 'A'
    }${firma.slice(medio + 1)}`;
    const resAlt = await fetch(`${BASE}/api/pedidos`, {
      headers: { Authorization: `Bearer ${alterado}` }
    });
    revisar('un token con la firma alterada da 401', resAlt.status === 401, `HTTP ${resAlt.status}`);

    // Y el ataque que de verdad se intenta: cambiar el contenido del token
    // (darse un rol distinto) conservando la firma original.
    const cargaFalsa = Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(carga, 'base64url').toString()),
        role: 'service_role'
      })
    ).toString('base64url');
    const resCarga = await fetch(`${BASE}/api/pedidos`, {
      headers: { Authorization: `Bearer ${cab}.${cargaFalsa}.${firma}` }
    });
    revisar(
      'un token con el contenido manipulado da 401',
      resCarga.status === 401,
      `HTTP ${resCarga.status}`
    );

    // Cabeceras de seguridad
    const raiz = await fetch(`${BASE}/login`);
    const esperadas = [
      'content-security-policy',
      'x-content-type-options',
      'x-frame-options',
      'referrer-policy',
      'permissions-policy'
    ];
    for (const c of esperadas) {
      revisar(`cabecera ${c}`, Boolean(raiz.headers.get(c)));
    }
    revisar('no anuncia x-powered-by', !raiz.headers.get('x-powered-by'));
  } finally {
    await admin.auth.admin.deleteUser(idUsuario);
    console.log('');
    console.log(`  usuario de prueba borrado (${CORREO})`);
  }

  console.log('  ' + '='.repeat(62));
  console.log(`  Revisiones: ${ok + fallas.length}   pasadas: ${ok}   fallidas: ${fallas.length}`);
  process.exit(fallas.length ? 1 : 0);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
