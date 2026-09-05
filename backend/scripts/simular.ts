/**
 * Corre el banco de escenarios contra el clasificador y dice, sin adornos,
 * cuantas peticiones de IA gastaria cada mil mensajes y donde se rompe.
 *
 *   npx tsx scripts/simular.ts
 */
import { clasificar } from '../src/modules/whatsapp/whatsapp.intents';
import { ESCENARIOS, type Espera } from './escenarios';

/** Los tipos que cortan el mensaje sin IA y sin crear nada. */
const BLOQUEAN = new Set([
  'ignorar',
  'humano',
  'cancelacion',
  'modificacion',
  'estado_pedido',
  'confirmacion',
  'rechazo',
  'repetir',
  'demasiado_largo',
  'solo_numero'
]);

const decision = (texto: string): { real: Espera; tipo: string } => {
  const tipo = clasificar(texto).tipo as string;
  if (tipo === 'usar_ia') return { real: 'ia', tipo };
  if (BLOQUEAN.has(tipo)) return { real: 'bloquea', tipo };
  return { real: 'local', tipo };
};

const recorte = (t: string, n = 46): string =>
  t.length > n ? `${t.slice(0, n)}...(${t.length})` : t || '(vacio)';

let ok = 0;
const fallas: string[] = [];
let aIA = 0;

console.log('');
console.log('  ESTADO  GRUPO         DECISION       MENSAJE');
console.log('  ' + '-'.repeat(84));

for (const e of ESCENARIOS) {
  const { real, tipo } = decision(e.texto);
  if (real === 'ia') aIA += 1;

  const bien = real === e.espera;
  if (bien) ok += 1;
  else fallas.push(`  [${e.grupo}] "${recorte(e.texto, 60)}"\n      espera=${e.espera} obtuvo=${real} (${tipo})${e.riesgo ? `\n      riesgo: ${e.riesgo}` : ''}`);

  console.log(
    `  ${bien ? ' OK ' : 'FALLA'}   ${e.grupo.padEnd(13)} ${tipo.padEnd(14)} ${recorte(e.texto)}`
  );
}

console.log('');
console.log('  ' + '='.repeat(84));
console.log(`  Escenarios: ${ESCENARIOS.length}   correctos: ${ok}   fallas: ${ESCENARIOS.length - ok}`);
console.log(`  Peticiones de IA que se gastarian: ${aIA} de ${ESCENARIOS.length}` +
  `  (${Math.round((aIA / ESCENARIOS.length) * 100)}%)`);

const debenIr = ESCENARIOS.filter((e) => e.espera === 'ia').length;
console.log(`  Deberian ser: ${debenIr}  ->  desperdicio: ${aIA - debenIr} peticiones`);

if (fallas.length) {
  console.log('');
  console.log('  FALLAS');
  console.log('  ' + '-'.repeat(84));
  for (const f of fallas) console.log(f + '\n');
}
