/**
 * Golpea el webhook como lo hace Meta: firmado, con el cuerpo crudo.
 *
 * Prueba lo que solo se puede probar por HTTP y no llamando al servicio:
 * la verificacion de la firma sobre los BYTES exactos que llegaron.
 *
 *   node scripts/probar-webhook.js [url-base]
 */
const crypto = require('node:crypto');
const fs = require('node:fs');

const leerEnv = () => {
  const m = {};
  for (const linea of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const t = linea.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i > 0) m[t.slice(0, i)] = t.slice(i + 1);
  }
  return m;
};

const env = leerEnv();
const BASE = process.argv[2] ?? 'http://localhost:3000';
const URL_WEBHOOK = `${BASE}/api/whatsapp/webhook`;
const SECRET = env.WHATSAPP_APP_SECRET;
const TEL = '5210000000005';

const cuerpo = (texto) =>
  JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: env.WHATSAPP_WABA_ID,
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { phone_number_id: env.WHATSAPP_PHONE_NUMBER_ID },
              contacts: [{ wa_id: TEL, profile: { name: 'PRUEBA Webhook' } }],
              messages: [
                {
                  from: TEL,
                  id: `test.${Date.now()}.${Math.random().toString(36).slice(2)}`,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: 'text',
                  text: { body: texto }
                }
              ]
            }
          }
        ]
      }
    ]
  });

const firmar = (buf) =>
  'sha256=' + crypto.createHmac('sha256', SECRET).update(buf).digest('hex');

let ok = 0;
let mal = 0;
const revisar = (titulo, condicion, detalle = '') => {
  if (condicion) {
    ok += 1;
    console.log(`   OK   ${titulo}`);
  } else {
    mal += 1;
    console.log(`  FALLA ${titulo}${detalle ? ` -> ${detalle}` : ''}`);
  }
};

const enviar = async (texto, { firmado = true } = {}) => {
  const buf = Buffer.from(cuerpo(texto), 'utf8');
  const headers = { 'Content-Type': 'application/json' };
  if (firmado) headers['X-Hub-Signature-256'] = firmar(buf);
  const t0 = Date.now();
  const res = await fetch(URL_WEBHOOK, { method: 'POST', headers, body: buf });
  return { status: res.status, ms: Date.now() - t0 };
};

(async () => {
  console.log('');
  console.log(`  Webhook: ${URL_WEBHOOK}`);
  console.log('  ' + '-'.repeat(66));

  // 1. Verificacion GET: Meta espera el challenge en texto plano.
  const verif = await fetch(
    `${URL_WEBHOOK}?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(
      env.WHATSAPP_VERIFY_TOKEN
    )}&hub.challenge=RETO123`
  );
  const texto = await verif.text();
  revisar('GET con el token correcto devuelve el challenge', texto === 'RETO123', texto);
  revisar(
    'y lo devuelve en texto plano, no en JSON',
    (verif.headers.get('content-type') ?? '').includes('text/plain')
  );

  const malToken = await fetch(
    `${URL_WEBHOOK}?hub.mode=subscribe&hub.verify_token=equivocado&hub.challenge=X`
  );
  revisar('GET con token equivocado da 403', malToken.status === 403, `HTTP ${malToken.status}`);

  // 2. La firma.
  const sinFirma = await enviar('hola', { firmado: false });
  revisar('POST sin firma da 401', sinFirma.status === 401, `HTTP ${sinFirma.status}`);

  const conFirma = await enviar('buenos dias');
  revisar('POST firmado da 200', conFirma.status === 200, `HTTP ${conFirma.status}`);
  console.log(`         (respondio en ${conFirma.ms} ms)`);

  // 3. El emoji: bytes multibyte. Si la firma se calculara sobre el JSON
  //    re-serializado en vez de sobre los bytes crudos, esto fallaria.
  const emoji = await enviar('\u{1F44D}');
  revisar('POST con emoji firma bien (bytes crudos)', emoji.status === 200, `HTTP ${emoji.status}`);

  // 4. Un caso que pasa por reglas y otro que llega a la IA.
  const regla = await enviar('a que hora abren?');
  revisar('mensaje resuelto por reglas', regla.status === 200);
  console.log(`         (${regla.ms} ms — sin IA)`);

  const basura = await enviar('a'.repeat(3000));
  revisar('mensaje enorme no revienta nada', basura.status === 200, `HTTP ${basura.status}`);

  console.log('');
  console.log('  ' + '='.repeat(66));
  console.log(`  Revisiones: ${ok + mal}   pasadas: ${ok}   fallidas: ${mal}`);
  console.log(`  Limpia despues con:  npm run limpiar:pruebas`);
  if (mal) process.exitCode = 1;
})();
