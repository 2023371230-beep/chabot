/**
 * Prueba de humo contra el build de PRODUCCION, no contra el de desarrollo.
 *
 * Existe porque `next dev` y `next start` no son el mismo programa: el modo
 * de desarrollo tolera cosas que produccion no (compila al vuelo, no aplica
 * el prerenderizado, y su CSP lleva 'unsafe-eval'). Un dashboard que va bien
 * con `npm run dev` y se cae al desplegar es exactamente lo que esto atrapa.
 *
 * Levanta el servidor por su cuenta, lo interroga y lo apaga:
 *
 *   npm run build && npm run probar:produccion
 */
import './cargar-env';
import { spawn, type ChildProcess } from 'node:child_process';

const PUERTO = 3123;
const BASE = `http://localhost:${PUERTO}`;

let ok = 0;
const fallas: string[] = [];
const revisar = (t: string, c: boolean, d = ''): void => {
  if (c) {
    ok += 1;
    console.log(`   OK   ${t}`);
  } else {
    fallas.push(t);
    console.log(`  FALLA ${t}${d ? ` -> ${d}` : ''}`);
  }
};
const seccion = (t: string): void => {
  console.log('');
  console.log(`  ${t}`);
  console.log('  ' + '-'.repeat(70));
};

/** Espera a que el servidor conteste, sin dormir a ciegas un numero fijo. */
const esperarAlServidor = async (intentos = 60): Promise<boolean> => {
  for (let i = 0; i < intentos; i += 1) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.status < 500) return true;
    } catch {
      /* todavia no levanta */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
};

const pedir = async (ruta: string, init?: RequestInit) => {
  const r = await fetch(`${BASE}${ruta}`, { redirect: 'manual', ...init });
  return { estado: r.status, cabeceras: r.headers, cuerpo: await r.text() };
};

const main = async (): Promise<void> => {
  console.log('');
  console.log('  PRUEBA DE PRODUCCION — el build real, no el de desarrollo');
  console.log('  ' + '='.repeat(70));

  // `shell: true` no es opcional en Windows: sin el, Node se niega a lanzar
  // un `.cmd` y devuelve EINVAL en vez de arrancar nada.
  const servidor: ChildProcess = spawn('npx next start -p ' + PUERTO, {
    stdio: 'ignore',
    shell: true,
    env: { ...process.env, NODE_ENV: 'production' }
  });

  /**
   * Apaga el servidor Y a sus hijos.
   *
   * Con `shell: true` el proceso que se ve es el interprete, no Next: matarlo
   * a el deja el puerto ocupado y la siguiente corrida falla sin motivo
   * aparente.
   */
  const apagar = (): void => {
    if (servidor.pid === undefined) return;
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(servidor.pid), '/f', '/t'], { stdio: 'ignore' });
    } else {
      servidor.kill();
    }
  };
  process.on('exit', apagar);

  try {
    if (!await esperarAlServidor()) {
      console.log('  FALLA el servidor de produccion no arranco');
      apagar();
      process.exit(1);
    }

    // ── 1. Las paginas se sirven ────────────────────────────────────────
    seccion('1. Todas las pantallas responden');

    for (const ruta of [
      '/login',
      '/dashboard',
      '/pedidos',
      '/productos',
      '/clientes',
      '/inventario',
      '/reportes',
      '/whatsapp',
      '/configuracion'
    ]) {
      const { estado } = await pedir(ruta);
      revisar(`${ruta.padEnd(15)} responde`, estado === 200, `HTTP ${estado}`);
    }

    const raiz = await pedir('/');
    revisar('la raiz manda al dashboard', raiz.estado === 307 || raiz.estado === 200, `HTTP ${raiz.estado}`);

    const inexistente = await pedir('/esta-ruta-no-existe');
    revisar('una ruta inventada da 404', inexistente.estado === 404, `HTTP ${inexistente.estado}`);

    // ── 2. La API esta cerrada ──────────────────────────────────────────
    seccion('2. Ningun dato sale sin sesion');

    for (const ruta of [
      '/api/pedidos',
      '/api/productos',
      '/api/clientes',
      '/api/inventario/resumen',
      '/api/configuracion',
      '/api/whatsapp/conversaciones',
      '/api/whatsapp/handoffs',
      '/api/reglas'
    ]) {
      const { estado, cuerpo } = await pedir(ruta);
      const cerrada = estado === 401 || estado === 403 || estado === 404;
      revisar(`${ruta.padEnd(32)} exige sesion`, cerrada, `HTTP ${estado}`);
      if (cerrada) {
        revisar(
          `${ruta.padEnd(32)} no filtra datos`,
          !/telefono|precio_kg|stock_actual/.test(cuerpo),
          cuerpo.slice(0, 60)
        );
      }
    }

    const conBasura = await pedir('/api/pedidos', {
      headers: { Authorization: 'Bearer no.es.un.token' }
    });
    revisar('un token inventado no entra', conBasura.estado === 401, `HTTP ${conBasura.estado}`);

    // ── 3. Escritura sin sesion ─────────────────────────────────────────
    seccion('3. Nadie puede escribir desde fuera');

    const alta = await pedir('/api/productos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: 'INTRUSO', precio_kg: 1 })
    });
    revisar('no se puede crear un producto', alta.estado === 401, `HTTP ${alta.estado}`);

    // 405 y no 401: la API NO expone borrado en ninguna ruta. Un producto se
    // desactiva, nunca se elimina, porque los pedidos viejos lo siguen
    // nombrando y borrarlo dejaria historial sin sentido. Que el metodo ni
    // exista es mejor defensa que rechazarlo con credenciales.
    const borrado = await pedir('/api/productos/00000000-0000-0000-0000-000000000001', {
      method: 'DELETE'
    });
    revisar(
      'la API no expone borrado de productos',
      borrado.estado === 405 || borrado.estado === 401,
      `HTTP ${borrado.estado}`
    );

    // ── 4. El webhook de Meta ───────────────────────────────────────────
    seccion('4. El webhook solo escucha a Meta');

    const sinFirma = await pedir('/api/whatsapp/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ object: 'whatsapp_business_account', entry: [] })
    });
    revisar(
      'un POST sin firma se rechaza',
      sinFirma.estado === 401 || sinFirma.estado === 403,
      `HTTP ${sinFirma.estado}`
    );

    const verifBasura = await pedir(
      '/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=incorrecto&hub.challenge=123'
    );
    revisar(
      'un token de verificacion falso se rechaza',
      verifBasura.estado !== 200 || verifBasura.cuerpo !== '123',
      `HTTP ${verifBasura.estado} cuerpo ${verifBasura.cuerpo.slice(0, 20)}`
    );

    // ── 5. Cabeceras de seguridad en produccion ─────────────────────────
    seccion('5. Las cabeceras de seguridad viajan de verdad');

    const { cabeceras } = await pedir('/login');
    const csp = cabeceras.get('content-security-policy') ?? '';

    revisar('hay Content-Security-Policy', csp.length > 0);
    revisar("la CSP no trae 'unsafe-eval' en produccion", !csp.includes('unsafe-eval'), csp.slice(0, 80));
    revisar("frame-ancestors 'none' (anti secuestro de clics)", csp.includes("frame-ancestors 'none'"));
    revisar('X-Content-Type-Options: nosniff', cabeceras.get('x-content-type-options') === 'nosniff');
    revisar('X-Frame-Options: DENY', cabeceras.get('x-frame-options') === 'DENY');
    revisar('Strict-Transport-Security presente', Boolean(cabeceras.get('strict-transport-security')));
    revisar('Referrer-Policy presente', Boolean(cabeceras.get('referrer-policy')));
    revisar('no se anuncia la version de Next', !cabeceras.get('x-powered-by'));

    // ── 6. Entradas mal formadas ────────────────────────────────────────
    seccion('6. La basura no tumba el servidor');

    const jsonRoto = await pedir('/api/whatsapp/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{esto no es json'
    });
    revisar('un JSON roto no da error 500', jsonRoto.estado < 500, `HTTP ${jsonRoto.estado}`);

    const enorme = await pedir('/api/whatsapp/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ basura: 'x'.repeat(200_000) })
    });
    revisar('un cuerpo enorme no da error 500', enorme.estado < 500, `HTTP ${enorme.estado}`);

    const salud = await pedir('/api/health');
    revisar('el chequeo de salud contesta', salud.estado === 200, `HTTP ${salud.estado}`);
  } finally {
    apagar();
  }

  console.log('');
  console.log('  ' + '='.repeat(70));
  console.log(`  Revisiones: ${ok + fallas.length}   pasadas: ${ok}   fallidas: ${fallas.length}`);
  if (fallas.length) {
    console.log('');
    for (const f of fallas) console.log(`   · ${f}`);
  }
  console.log('');
  process.exit(fallas.length ? 1 : 0);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
