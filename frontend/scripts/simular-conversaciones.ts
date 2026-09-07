/**
 * Prueba la memoria corta y el presupuesto contra la base real.
 *
 * El clasificador se prueba mensaje por mensaje en `simular.ts`. Aqui se
 * prueba lo que solo se rompe con VARIOS mensajes seguidos: cotizaciones que
 * se confirman, pedidos que se duplican y clientes que saturan la cuota.
 *
 * Va contra la base y no contra memoria del proceso porque ahi es donde vive
 * ahora el estado: en Vercel cada peticion puede caer en una instancia
 * distinta, y una prueba en memoria no diria nada sobre lo que pasa en
 * produccion.
 *
 *   npx tsx scripts/simular-conversaciones.ts
 */
import './cargar-env';
import { supabase } from '../server/database/supabase.client';
import { clasificar } from '../server/modules/whatsapp/whatsapp.intents';
import { firmaPedido, Memoria } from '../server/modules/whatsapp/whatsapp.memoria';
import { puedeUsarIA, registrarUso } from '../server/modules/whatsapp/whatsapp.presupuesto';

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

const TEL = '5210000000003';
const TEL2 = '5210000000004';
const PECHUGA = '00000000-0000-0000-0000-0000000000aa';
const PIERNA = '00000000-0000-0000-0000-0000000000bb';

const limpiar = async (): Promise<void> => {
  await supabase.from('conversaciones_whatsapp').delete().in('telefono', [TEL, TEL2]);
  await supabase.from('ia_peticiones').delete().in('telefono', [TEL, TEL2]);
};

const main = async (): Promise<void> => {
  await limpiar();

  // ── 1. Cotizacion confirmada sin gastar IA ────────────────────────────
  seccion('1. "Le sale en $1,900. Se lo aparto?"  ->  "si porfa"');

  revisar('el "si porfa" no llega a la IA', clasificar('si porfa').tipo === 'confirmacion');

  let m = await Memoria.cargar(TEL);
  m.recordarCotizacion([{ producto_id: PECHUGA, kg: 20 }], { fechaEntrega: '2026-09-11' });
  await m.guardar();

  // Otra instancia: es lo que pasa en Vercel entre un mensaje y el siguiente.
  m = await Memoria.cargar(TEL);
  const recuperada = m.tomarCotizacion();
  revisar('otra instancia recupera la cotizacion', recuperada?.renglones[0].kg === 20);
  revisar('conserva la fecha de entrega', recuperada?.fechaEntrega === '2026-09-11');
  await m.guardar();

  m = await Memoria.cargar(TEL);
  revisar('un segundo "si" ya no crea otro pedido', m.tomarCotizacion() === null);

  // ── 2. Respuesta a "cuantos kilos?" ───────────────────────────────────
  seccion('2. "Cuantos kilos de pechuga?"  ->  "20"');

  const soloNumero = clasificar('20');
  revisar('el numero suelto no llega a la IA', soloNumero.tipo === 'solo_numero');
  revisar('se lee el valor', soloNumero.tipo === 'solo_numero' && soloNumero.valor === 20);

  m = await Memoria.cargar(TEL);
  m.recordarPreguntaKg(PECHUGA, 'Pechuga');
  await m.guardar();

  m = await Memoria.cargar(TEL);
  revisar('se recuerda de que corte se pregunto', m.tomarPreguntaKg()?.nombre === 'Pechuga');
  await m.guardar();

  m = await Memoria.cargar(TEL);
  revisar('no se reutiliza dos veces', m.tomarPreguntaKg() === null);

  // ── 3. El cliente reenvia el mismo texto ──────────────────────────────
  seccion('3. El cliente no ve la palomita y reenvia lo mismo');

  m = await Memoria.cargar(TEL);
  m.recordarRespuesta('20 kilos de pechuga', 'Le anote 20 kg de Pechuga');
  await m.guardar();

  m = await Memoria.cargar(TEL);
  revisar(
    'el reenvio se contesta de la cache, sin IA',
    m.respuestaRepetida('20 kilos de pechuga') === 'Le anote 20 kg de Pechuga'
  );
  revisar(
    'ignora mayusculas y espacios de mas',
    m.respuestaRepetida('  20 KILOS   de Pechuga ') !== null
  );
  revisar('un texto distinto si se procesa', m.respuestaRepetida('30 kilos de pechuga') === null);

  const otra = await Memoria.cargar(TEL2);
  revisar('la cache es por telefono, no global', otra.respuestaRepetida('20 kilos de pechuga') === null);

  // ── 4. Mismo pedido escrito con otras palabras ────────────────────────
  seccion('4. "20 kilos de pechuga" y luego "mandame 20 de pechuga"');

  m = await Memoria.cargar(TEL);
  m.recordarPedido(firmaPedido([{ producto_id: PECHUGA, kg: 20 }]), 'Le anote 20 kg de Pechuga');
  await m.guardar();

  m = await Memoria.cargar(TEL);
  revisar(
    'el segundo mensaje NO crea otro pedido',
    m.pedidoDuplicado(firmaPedido([{ producto_id: PECHUGA, kg: 20 }])) !== null
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
    m.pedidoDuplicado(firmaPedido([{ producto_id: PECHUGA, kg: 30 }])) === null
  );

  // ── 5. Fallos seguidos ────────────────────────────────────────────────
  seccion('5. El bot no entiende tres veces seguidas');

  m = await Memoria.cargar(TEL);
  revisar('primer fallo', m.contarFallo() === 1);
  await m.guardar();

  m = await Memoria.cargar(TEL);
  revisar('el segundo se acumula entre instancias', m.contarFallo() === 2);
  revisar('el tercero dispara el paso a una persona', m.contarFallo() === 3);
  m.limpiarFallos();
  await m.guardar();

  m = await Memoria.cargar(TEL);
  revisar('un mensaje bien atendido borra la cuenta', m.contarFallo() === 1);

  // ── 6. El presupuesto compartido ──────────────────────────────────────
  seccion('6. Un numero manda mensajes de mas');

  await limpiar();

  const antes = await puedeUsarIA(TEL);
  revisar('con la cuota limpia deja pasar', antes.permitido);

  // 20 por telefono por hora es el tope; se registran 20 y el 21 debe cortar.
  for (let i = 0; i < 20; i += 1) await registrarUso(TEL);

  const despues = await puedeUsarIA(TEL);
  revisar(
    'corta al pasarse de su cuota por hora',
    !despues.permitido,
    `permitido=${despues.permitido}`
  );
  revisar(
    'el motivo es el correcto',
    !despues.permitido && (despues.motivo === 'telefono' || despues.motivo === 'minuto'),
    !despues.permitido ? `motivo=${despues.motivo}` : ''
  );

  await limpiar();

  console.log('');
  console.log('  ' + '='.repeat(74));
  console.log(
    `  Revisiones: ${pasadas + fallidas.length}   pasadas: ${pasadas}   fallidas: ${fallidas.length}`
  );
  if (fallidas.length) {
    console.log('');
    for (const f of fallidas) console.log(`   - ${f}`);
    process.exitCode = 1;
  }
  process.exit(fallidas.length ? 1 : 0);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
