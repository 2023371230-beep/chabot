/**
 * Comprueba que ninguna llave se escape.
 *
 * Existe porque una fuga de credenciales no se parece a un fallo: nada se
 * rompe, nada avisa, y te enteras cuando ya alguien vacio la base. Las cuatro
 * formas reales de que pase en este proyecto son las cuatro que se revisan
 * aqui, y ninguna requiere mala fe — basta un `git add -A` un dia con prisa o
 * un `NEXT_PUBLIC_` de mas.
 *
 *   npm run probar:secretos
 *
 * La revision del paquete del navegador necesita `npm run build` antes; sin
 * el, esa parte se salta y lo dice en vez de dar por buena una comprobacion
 * que no hizo.
 */
import './cargar-env';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

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

/** Las que, si se filtran, dan acceso real. La publicable NO va aqui. */
const SECRETAS = [
  'SUPABASE_SECRET_KEY',
  'GROQ_API_KEY',
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_APP_SECRET',
  'WHATSAPP_VERIFY_TOKEN'
];

/**
 * Formas de las llaves de cada proveedor.
 *
 * Sirven para buscar en el historial de git SIN tener el valor delante: una
 * llave vieja, ya rotada y olvidada, sigue siendo una llave que estuvo
 * publicada, y no aparece en el `.env.local` de hoy.
 */
const PATRONES = [
  { nombre: 'JWT de Supabase', re: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]{20,}/ },
  { nombre: 'llave secreta de Supabase', re: /sb_secret_[A-Za-z0-9_-]{20,}/ },
  { nombre: 'llave de Groq', re: /gsk_[A-Za-z0-9]{40,}/ },
  { nombre: 'token de Meta', re: /EAA[A-Za-z0-9]{80,}/ }
];

const git = (cmd: string): string => {
  try {
    return execSync(`git ${cmd}`, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return '';
  }
};

const main = (): void => {
  console.log('');
  console.log('  SECRETOS — que ninguna llave se escape');
  console.log('  ' + '='.repeat(70));

  // ── 1. Nada de env en el repositorio ─────────────────────────────────
  seccion('1. Ningun archivo de entorno esta versionado');

  const versionados = git('ls-files')
    .split('\n')
    .filter((f) => /(^|\/)\.env/.test(f) && !f.includes('example'));
  revisar(
    'no hay .env rastreado por git',
    versionados.length === 0,
    versionados.join(', ')
  );

  for (const nombre of ['.env', '.env.local', '.env.production', 'client/.env', 'server/.env']) {
    let ignorado = true;
    try {
      execSync(`git check-ignore -q "${nombre}"`, { stdio: 'ignore' });
    } catch {
      ignorado = false;
    }
    revisar(`.gitignore cubre ${nombre}`, ignorado);
  }

  // ── 2. Ni ahora ni nunca ─────────────────────────────────────────────
  seccion('2. Ninguna llave aparece en el historial completo de git');

  // Se recorre el contenido de TODAS las revisiones: borrar un archivo con
  // una llave no la quita del historial, y ahi sigue siendo publica.
  const revisiones = git('rev-list --all').split('\n').filter(Boolean);
  let historial = '';
  if (revisiones.length) {
    historial = git(`grep -I -h -E "${PATRONES.map((p) => p.re.source).join('|')}" ${revisiones.join(' ')}`);
  }
  for (const p of PATRONES) {
    revisar(`sin ${p.nombre} en el historial`, !p.re.test(historial));
  }

  // ── 3. Nada secreto viaja al navegador ───────────────────────────────
  seccion('3. Ninguna llave secreta llega al navegador');

  for (const nombre of SECRETAS) {
    revisar(
      `${nombre} no lleva prefijo NEXT_PUBLIC_`,
      !process.env[`NEXT_PUBLIC_${nombre}`]
    );
  }

  if (!fs.existsSync('.next/static')) {
    console.log('   --   el paquete del navegador no esta compilado; corre `npm run build` para revisarlo');
  } else {
    const archivos: string[] = [];
    const recorrer = (d: string): void => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const f = path.join(d, e.name);
        if (e.isDirectory()) recorrer(f);
        else archivos.push(f);
      }
    };
    recorrer('.next/static');
    const paquete = archivos.map((f) => fs.readFileSync(f, 'utf8')).join('\n');

    for (const nombre of SECRETAS) {
      const valor = process.env[nombre];
      if (!valor) continue;
      revisar(`${nombre} no aparece en el paquete`, !paquete.includes(valor));
    }
    console.log(`   --   revisados ${archivos.length} archivos de .next/static`);
  }

  // ── 4. El ejemplo es un ejemplo ──────────────────────────────────────
  seccion('4. .env.example no trae valores de verdad');

  if (fs.existsSync('.env.example')) {
    const ejemplo = fs.readFileSync('.env.example', 'utf8');
    for (const p of PATRONES) {
      revisar(`.env.example sin ${p.nombre}`, !p.re.test(ejemplo));
    }
    for (const nombre of SECRETAS) {
      const valor = process.env[nombre];
      revisar(
        `.env.example no repite el valor real de ${nombre}`,
        !valor || !ejemplo.includes(valor)
      );
    }
  }

  console.log('');
  console.log('  ' + '='.repeat(70));
  console.log(`  Revisiones: ${ok + fallas.length}   pasadas: ${ok}   fallidas: ${fallas.length}`);
  if (fallas.length) {
    console.log('');
    for (const f of fallas) console.log(`   · ${f}`);
    console.log('');
    console.log('  Si una llave se publico: ROTARLA es lo primero. Borrarla del');
    console.log('  historial no sirve — quien ya la copio la sigue teniendo.');
  }
  console.log('');
  process.exit(fallas.length ? 1 : 0);
};

main();
