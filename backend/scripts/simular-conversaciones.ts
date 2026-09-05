/**
 * Simula conversaciones completas contra las guardas: memoria corta y
 * presupuesto de IA. No toca la base ni la red.
 *
 * El clasificador se prueba mensaje por mensaje en `simular.ts`. Aqui se
 * prueba lo que solo se rompe con VARIOS mensajes seguidos: cotizaciones que
 * se confirman, pedidos que se duplican y clientes que saturan la cuota.
 *
 *   npx tsx scripts/simular-conversaciones.ts
 */
import { clasificar } from '../src/modules/whatsapp/whatsapp.intents';
import {
  firmaPedido,
  olvidarTodo,
  pedidoDuplicado,
  recordarCotizacion,
  recordarPedido,
  recordarPreguntaKg,
  recordarRespuesta,
  respuestaRepetida,
  tomarCotizacion,
  tomarPreguntaKg
} from '../src/modules/whatsapp/whatsapp.memoria';
import {
  puedeUsarIA,
  registrarUso,
  reiniciarPresupuesto
} from '../src/modules/whatsapp/whatsapp.presupuesto';

let pasadas = 0;
const fallidas: string[] = [];

const revisar = (titulo: string, condicion: boolean, detalle = ''): void => {
  if (condicion) {
    pasadas += 1;
    console.log(`   OK   ${titulo}`);
  } else {
    fallidas.push(`${titulo}${detalle ? ` -> ${detalle}` : ''}`);
    console.log(`  FALLA ${titulo}${detalle ? ` -> ${detalle}` : ''}`);
  }
};

const seccion = (t: string): void => {
  console.log('');
  console.log(`  ${t}`);
  console.log('  ' + '-'.repeat(74));
};

const TEL = '5215512345678';
const PECHUGA = 'uuid-pechuga';
const PIERNA = 'uuid-pierna';

// ── 1. Cotizacion confirmada sin gastar IA ──────────────────────────────
seccion('1. "Le sale en $1,900. Se lo aparto?"  ->  "si porfa"');
olvidarTodo();

recordarCotizacion(TEL, [{ producto_id: PECHUGA, kg: 20 }], '2026-09-11');
revisar('el "si porfa" no llega a la IA', clasificar('si porfa').tipo === 'confirmacion');

const recuperada = tomarCotizacion(TEL);
revisar('se recupera la cotizacion guardada', recuperada?.renglones[0].kg === 20);
revisar('conserva la fecha de entrega', recuperada?.fechaEntrega === '2026-09-11');
revisar(
  'un segundo "si" ya no crea otro pedido',
  tomarCotizacion(TEL) === null,
  'la cotizacion debe borrarse al usarse'
);

// ── 2. Respuesta a "cuantos kilos?" ─────────────────────────────────────
seccion('2. "Cuantos kilos de pechuga?"  ->  "20"');
olvidarTodo();

const soloNumero = clasificar('20');
revisar('el numero suelto no llega a la IA', soloNumero.tipo === 'solo_numero');
revisar(
  'se lee el valor',
  soloNumero.tipo === 'solo_numero' && soloNumero.valor === 20
);

recordarPreguntaKg(TEL, PECHUGA, 'Pechuga');
const pendiente = tomarPreguntaKg(TEL);
revisar('se recuerda de que corte se pregunto', pendiente?.nombre === 'Pechuga');
revisar('no se reutiliza dos veces', tomarPreguntaKg(TEL) === null);

// ── 3. El cliente reenvia el mismo texto ────────────────────────────────
seccion('3. El cliente no ve la palomita y reenvia lo mismo');
olvidarTodo();

recordarRespuesta(TEL, '20 kilos de pechuga', 'Le anote 20 kg de Pechuga');
revisar(
  'el reenvio se contesta de la cache, sin IA',
  respuestaRepetida(TEL, '20 kilos de pechuga') === 'Le anote 20 kg de Pechuga'
);
revisar(
  'ignora mayusculas y espacios de mas',
  respuestaRepetida(TEL, '  20 KILOS   de Pechuga ') !== null
);
revisar(
  'un texto distinto si se procesa',
  respuestaRepetida(TEL, '30 kilos de pechuga') === null
);
revisar(
  'la cache es por telefono, no global',
  respuestaRepetida('5215500000000', '20 kilos de pechuga') === null
);

// ── 4. Mismo pedido escrito con otras palabras ──────────────────────────
seccion('4. "20 kilos de pechuga" y luego "mandame 20 de pechuga"');
olvidarTodo();

const firmaA = firmaPedido([{ producto_id: PECHUGA, kg: 20 }]);
recordarPedido(TEL, firmaA, 'Le anote 20 kg de Pechuga');

revisar(
  'el segundo mensaje NO crea otro pedido',
  pedidoDuplicado(TEL, firmaPedido([{ producto_id: PECHUGA, kg: 20 }])) !== null,
  'la huella de los renglones debe coincidir'
);
revisar(
  'el orden de los renglones no cambia la huella',
  firmaPedido([
    { producto_id: PECHUGA, kg: 20 },
    { producto_id: PIERNA, kg: 10 }
  ]) ===
    firmaPedido([
      { producto_id: PIERNA, kg: 10 },
      { producto_id: PECHUGA, kg: 20 }
    ])
);
revisar(
  'cambiar los kilos SI es un pedido nuevo',
  pedidoDuplicado(TEL, firmaPedido([{ producto_id: PECHUGA, kg: 30 }])) === null
);

// ── 5. Un cliente solo no puede tumbar el bot ───────────────────────────
seccion('5. Un numero manda 25 mensajes seguidos');
reiniciarPresupuesto();

let bloqueadoEn = 0;
for (let i = 1; i <= 25; i += 1) {
  const v = puedeUsarIA(TEL);
  if (!v.permitido) {
    bloqueadoEn = i;
    revisar(
      `se corta en el mensaje ${i} por "${v.motivo}"`,
      v.motivo === 'minuto' || v.motivo === 'telefono'
    );
    break;
  }
  registrarUso(TEL);
}
revisar('se corto antes de los 25', bloqueadoEn > 0 && bloqueadoEn <= 16, `corto en ${bloqueadoEn}`);
revisar(
  'el corte protege los 8000 tokens/min (15 x ~400 = 6000)',
  bloqueadoEn === 16,
  `corto en ${bloqueadoEn}, se esperaba 16`
);

// ── 6. Otro cliente no paga el exceso del primero ───────────────────────
seccion('6. Otro cliente escribe en ese mismo minuto');
reiniciarPresupuesto();

for (let i = 0; i < 20; i += 1) {
  if (puedeUsarIA(TEL).permitido) registrarUso(TEL);
}
const otro = puedeUsarIA('5215599999999');
revisar(
  'queda bloqueado por el ritmo del minuto, no por su culpa',
  !otro.permitido && otro.motivo === 'minuto',
  'es lo correcto: el limite de tokens es compartido'
);

console.log('');
console.log('  ' + '='.repeat(74));
console.log(`  Revisiones: ${pasadas + fallidas.length}   pasadas: ${pasadas}   fallidas: ${fallidas.length}`);
if (fallidas.length) {
  console.log('');
  for (const f of fallidas) console.log(`   - ${f}`);
  process.exitCode = 1;
}
