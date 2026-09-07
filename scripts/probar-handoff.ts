/**
 * Prueba el apagado controlado de punta a punta, contra la base real.
 *
 * Verifica lo que de verdad importa del handoff, que no es el mensaje bonito
 * sino que el bot SE CALLE: si sigue contestando por debajo, el cliente ve dos
 * voces distintas en el mismo chat y el asesor queda como tonto.
 *
 * MANDA UNA ALERTA DE VERDAD al numero de WHATSAPP_ALERTA_NUMERO.
 *
 *   npx tsx scripts/probar-handoff.ts
 */
import './cargar-env';
import { supabase } from '../server/database/supabase.client';
import { whatsappService } from '../server/modules/whatsapp/whatsapp.service';
import { estaPausada, listarPendientes, reanudar } from '../server/modules/whatsapp/whatsapp.handoff';

const TEL = '5210000000002';

let ok = 0;
const fallas: string[] = [];

const revisar = (titulo: string, condicion: boolean, detalle = ''): void => {
  if (condicion) {
    ok += 1;
    console.log(`   OK   ${titulo}`);
  } else {
    fallas.push(titulo);
    console.log(`  FALLA ${titulo}${detalle ? ` -> ${detalle}` : ''}`);
  }
};

const decir = async (texto: string): Promise<string> => {
  const { respuesta } = await whatsappService.atender(texto, TEL, 'PRUEBA Handoff');
  console.log('');
  console.log(`  CLIENTE > ${texto}`);
  if (!respuesta) console.log('  BOT     > [callado]');
  else for (const l of respuesta.split('\n')) console.log(`  BOT     > ${l}`);
  return respuesta;
};

const limpiar = async (): Promise<void> => {
  await supabase.from('conversaciones_whatsapp').delete().eq('telefono', TEL);
  await supabase.from('mensajes_whatsapp').delete().eq('telefono', TEL);
  const { data: cli } = await supabase.from('clientes').select('id').eq('telefono', TEL);
  const ids = (cli ?? []).map((c: { id: string }) => c.id);
  if (ids.length) {
    const { data: peds } = await supabase.from('pedidos').select('id').in('cliente_id', ids);
    const pids = (peds ?? []).map((p: { id: string }) => p.id);
    if (pids.length) {
      await supabase.from('pedido_detalles').delete().in('pedido_id', pids);
      await supabase.from('pedidos').delete().in('id', pids);
    }
    await supabase.from('clientes').delete().in('id', ids);
  }
};

const main = async (): Promise<void> => {
  await limpiar();

  console.log('');
  console.log('  1. REGATEO Y CREDITO — el caso que la IA aprobaria sola');
  console.log('  ' + '-'.repeat(72));

  const r1 = await decir('Te compro 100 kg pero a 30 dias o hazme rebaja de $10 por kilo');
  revisar('contesta que lo ve administracion', r1.toLowerCase().includes('administracion'));
  revisar('NO promete el descuento', !/\bs[ií] (?:se|le) (?:puede|hago)\b/i.test(r1));
  revisar('el bot queda pausado', await estaPausada(TEL));

  console.log('');
  console.log('  2. EL BOT SE CALLA — lo que hace util al handoff');
  console.log('  ' + '-'.repeat(72));

  const r2 = await decir('bueno entonces mandame 20 kilos de pechuga');
  revisar('ya no contesta nada', r2 === '', `contesto: "${r2.slice(0, 60)}"`);

  const { data: pedidosDurante } = await supabase
    .from('clientes')
    .select('id, pedidos(id)')
    .eq('telefono', TEL);
  const creadosDurante = (pedidosDurante ?? []).flatMap(
    (c: { pedidos?: unknown[] }) => c.pedidos ?? []
  );
  revisar('tampoco crea pedidos a espaldas del asesor', creadosDurante.length === 0);

  console.log('');
  console.log('  3. LA ALERTA — lo que ve el encargado');
  console.log('  ' + '-'.repeat(72));

  const pendientes = await listarPendientes();
  const mio = pendientes.find((p) => p.telefono === TEL);
  revisar('el chat aparece en la lista de pendientes', Boolean(mio));
  revisar('con el motivo correcto', mio?.motivo === 'negociacion', `motivo: ${mio?.motivo}`);
  revisar('con el mensaje que lo disparo', Boolean(mio?.ultimoMensaje));
  console.log(`         -> "${mio?.motivo}" — ${mio?.nombreCliente ?? mio?.telefono}`);
  console.log(`         -> escribio: "${(mio?.ultimoMensaje ?? '').slice(0, 60)}..."`);
  console.log(`         -> total de chats esperando ahorita: ${pendientes.length}`);

  const { data: rastro } = await supabase
    .from('mensajes_whatsapp')
    .select('mensaje')
    .eq('telefono', TEL)
    .eq('tipo', 'sistema');
  revisar(
    'queda el rastro en el hilo para el que abra el chat',
    (rastro ?? []).some((m: { mensaje: string }) => m.mensaje.includes('[HANDOFF]'))
  );

  console.log('');
  console.log('  4. REANUDAR — el asesor devuelve el chat al bot');
  console.log('  ' + '-'.repeat(72));

  revisar('se reanuda', await reanudar(TEL));
  revisar('ya no esta pausado', !(await estaPausada(TEL)));

  const r4 = await decir('a como esta la pechuga?');
  revisar('el bot vuelve a atender', r4.length > 0 && r4.toLowerCase().includes('pechuga'));

  console.log('');
  console.log('  5. ENOJO — la otra rama urgente');
  console.log('  ' + '-'.repeat(72));

  const r5 = await decir('son unos rateros, el pollo venia echado a perder');
  revisar('reconoce el problema', /lament|entiendo/i.test(r5));
  revisar('pausa el bot', await estaPausada(TEL));

  await reanudar(TEL);

  console.log('');
  console.log('  6. STOCK IMPOSIBLE — no prometer lo que no hay');
  console.log('  ' + '-'.repeat(72));

  const { data: prod } = await supabase
    .from('productos')
    .select('nombre, stock_actual')
    .eq('nombre', 'Pechuga')
    .single();
  const hay = Number(prod?.stock_actual ?? 0);
  const pide = Math.max(300, Math.ceil(hay * 3));
  console.log(`         (en camara hay ${hay} kg de Pechuga; se piden ${pide})`);

  const r6 = await decir(`necesito ${pide} kilos de pechuga para hoy`);
  revisar('no promete la entrega inmediata', !/con gusto\. le anote/i.test(r6));
  revisar('ofrece surtido parcial o programado', /parcial|programar/i.test(r6));
  revisar('pausa el bot', await estaPausada(TEL));

  const { data: cliFinal } = await supabase
    .from('clientes')
    .select('id, pedidos(id)')
    .eq('telefono', TEL);
  const totalPedidos = (cliFinal ?? []).flatMap((c: { pedidos?: unknown[] }) => c.pedidos ?? []);
  revisar('no se creo ningun pedido imposible', totalPedidos.length === 0);

  await limpiar();

  console.log('');
  console.log('  ' + '='.repeat(72));
  console.log(`  Revisiones: ${ok + fallas.length}   pasadas: ${ok}   fallidas: ${fallas.length}`);
  if (fallas.length) {
    for (const f of fallas) console.log(`   - ${f}`);
    process.exitCode = 1;
  }
  console.log('  (revisa tu WhatsApp: debieron llegar 3 alertas)');
};

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
