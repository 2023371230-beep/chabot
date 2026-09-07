/**
 * Comprueba que ningun pedido nace sin que el cliente lo confirme dos veces.
 *
 * Va contra la base y contra la IA de verdad. Es a proposito: lo que se esta
 * probando es justamente que la lectura de la IA NO llegue sola hasta la tabla
 * de pedidos, y una IA simulada no probaria eso — probaria el simulacro.
 *
 * El unico atajo es el reloj: para ver que pasa con un "si" que llega tarde se
 * envejece el borrador escribiendo su marca de tiempo hacia atras, en vez de
 * esperar media hora.
 *
 *   npm run probar:doble-confirmacion
 */
import './cargar-env';
import { supabase } from '../server/database/supabase.client';
import { whatsappService } from '../server/modules/whatsapp/whatsapp.service';
import { productosService } from '../server/modules/productos/productos.service';

const TEL = '5210000000081';

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
  console.log('  ' + '-'.repeat(72));
};

/** Deja el chat como si el cliente escribiera por primera vez. */
const borrarConversacion = async (): Promise<void> => {
  await supabase.from('conversaciones_whatsapp').delete().eq('telefono', TEL);
  await supabase.from('ia_peticiones').delete().eq('telefono', TEL);
};

const borrarPedidos = async (): Promise<void> => {
  const { data: cliente } = await supabase
    .from('clientes')
    .select('id')
    .eq('telefono', TEL)
    .maybeSingle();
  if (!cliente) return;
  const { data: pedidos } = await supabase.from('pedidos').select('id').eq('cliente_id', cliente.id);
  for (const p of pedidos ?? []) {
    await supabase.from('pedido_detalles').delete().eq('pedido_id', p.id);
    await supabase.from('inventario_movimientos').delete().eq('pedido_id', p.id);
  }
  await supabase.from('pedidos').delete().eq('cliente_id', cliente.id);
};

const contarPedidos = async (): Promise<number> => {
  const { data: cliente } = await supabase
    .from('clientes')
    .select('id')
    .eq('telefono', TEL)
    .maybeSingle();
  if (!cliente) return 0;
  const { count } = await supabase
    .from('pedidos')
    .select('id', { count: 'exact', head: true })
    .eq('cliente_id', cliente.id);
  return count ?? 0;
};

/** Retrasa el reloj del borrador guardado, sin tocar nada mas. */
const envejecerBorrador = async (minutos: number): Promise<void> => {
  const { data } = await supabase
    .from('conversaciones_whatsapp')
    .select('id, contexto')
    .eq('telefono', TEL)
    .maybeSingle();
  if (!data?.contexto?.cotizacion) return;
  const ctx = data.contexto as Record<string, { en: number }>;
  ctx.cotizacion.en = Date.now() - minutos * 60_000;
  await supabase.from('conversaciones_whatsapp').update({ contexto: ctx }).eq('id', data.id);
};

const pausado = async (): Promise<boolean> => {
  const { data } = await supabase
    .from('conversaciones_whatsapp')
    .select('estado')
    .eq('telefono', TEL)
    .maybeSingle();
  return data?.estado === 'escalado_humano';
};

const main = async (): Promise<void> => {
  console.log('');
  console.log('  DOBLE CONFIRMACION — ningun pedido sin un "si" del cliente');
  console.log('  ' + '='.repeat(72));

  await borrarConversacion();
  await borrarPedidos();

  // ── 1. El camino normal ────────────────────────────────────────────────
  seccion('1. "quiero 12 kilos de pechuga" -> se cotiza, NO se crea');

  const antes = await contarPedidos();
  const cotiza = await whatsappService.atender('quiero 12 kilos de pechuga', TEL, 'PRUEBA Doble');

  revisar('la IA no crea el pedido sola', cotiza.pedidoId === undefined);
  revisar('siguen los mismos pedidos en la base', (await contarPedidos()) === antes);
  revisar('se le muestra el total', /Total:/.test(cotiza.respuesta));
  revisar('se le dice que todavia no esta anotado', /Todavia no lo anoto/.test(cotiza.respuesta));
  revisar('se le pide el "si"', /confirma/i.test(cotiza.respuesta));

  seccion('2. "si porfa" -> ahora si nace el pedido');

  const confirma = await whatsappService.atender('si porfa', TEL);
  revisar('el "si" crea el pedido', Boolean(confirma.pedidoId));
  revisar('hay un pedido mas', (await contarPedidos()) === antes + 1);
  revisar('el acuse dice que quedo anotado', /ya se lo anote/i.test(confirma.respuesta));

  const { data: creado } = await supabase
    .from('pedidos')
    .select('estado, total_kg, origen')
    .eq('id', confirma.pedidoId!)
    .single();
  revisar('nace pendiente, sin mover inventario', creado?.estado === 'pendiente');
  revisar('con los kilos que se cotizaron', Number(creado?.total_kg) === 12);
  revisar('marcado como pedido de whatsapp', creado?.origen === 'whatsapp');

  seccion('3. Un segundo "si" no duplica el pedido');

  const otraVez = await whatsappService.atender('si', TEL);
  revisar('no crea un segundo pedido', otraVez.pedidoId === undefined);
  revisar('sigue habiendo uno solo', (await contarPedidos()) === antes + 1);

  // ── 4. Cambiar de opinion sobre el borrador ────────────────────────────
  await borrarConversacion();
  await borrarPedidos();
  seccion('4. "mejor que sean 20" sobre un borrador -> se recotiza, no escala');

  await whatsappService.atender('quiero 10 kilos de pechuga', TEL, 'PRUEBA Doble');
  const cambio = await whatsappService.atender('mejor que sean 20 kilos', TEL);

  revisar('no llama a una persona por un borrador', !(await pausado()));
  revisar('sigue sin crear pedido', (await contarPedidos()) === 0);
  revisar('vuelve a cotizar', /Total:/.test(cambio.respuesta));
  revisar('con la cantidad nueva', /20 kg/.test(cambio.respuesta), cambio.respuesta);

  const trasCambio = await whatsappService.atender('si porfa', TEL);
  revisar('el "si" confirma la version nueva', Boolean(trasCambio.pedidoId));
  const { data: final } = await supabase
    .from('pedidos')
    .select('total_kg')
    .eq('id', trasCambio.pedidoId!)
    .single();
  revisar('se anotan 20 kg, no 10 ni 30', Number(final?.total_kg) === 20);

  // ── 5. El bucle de indecision ──────────────────────────────────────────
  await borrarConversacion();
  await borrarPedidos();
  seccion('5. Cuatro cambios sin cerrar -> lo toma una persona');

  await whatsappService.atender('quiero 10 kilos de pechuga', TEL, 'PRUEBA Doble');
  await whatsappService.atender('mejor que sean 15 kilos', TEL);
  await whatsappService.atender('mejor que sean 25 kilos', TEL);
  const harto = await whatsappService.atender('mejor que sean 30 kilos', TEL);

  revisar('el chat pasa a una persona', await pausado());
  revisar('no se creo ningun pedido en el camino', (await contarPedidos()) === 0);
  revisar('se le avisa sin dar nombres', !/[A-Z][a-z]+ le (?:atiende|contesta)/.test(harto.respuesta));

  const { data: escalado } = await supabase
    .from('conversaciones_whatsapp')
    .select('contexto')
    .eq('telefono', TEL)
    .maybeSingle();
  revisar(
    'el motivo queda escrito para el dashboard',
    /cambios al pedido/.test(String((escalado?.contexto as { detalle?: string })?.detalle ?? '')),
    String((escalado?.contexto as { detalle?: string })?.detalle)
  );

  // ── 6. El "si" que llega tarde ─────────────────────────────────────────
  await borrarConversacion();
  await borrarPedidos();
  seccion('6. Un "si" media hora despues -> se recotiza con los precios de hoy');

  await whatsappService.atender('quiero 8 kilos de pechuga', TEL, 'PRUEBA Doble');
  await envejecerBorrador(45);
  const tarde = await whatsappService.atender('si porfa', TEL);

  revisar('no confirma un precio viejo', tarde.pedidoId === undefined);
  revisar('lo dice en vez de callarselo', /Paso un rato/.test(tarde.respuesta));
  revisar('vuelve a poner el total', /Total:/.test(tarde.respuesta));

  const alFin = await whatsappService.atender('si', TEL);
  revisar('el segundo "si" ya lo cierra', Boolean(alFin.pedidoId));

  // ── 7. El inventario se movio mientras lo pensaba ──────────────────────
  await borrarConversacion();
  await borrarPedidos();
  seccion('7. El stock cae entre la cotizacion y el "si"');

  const catalogo = await productosService.findAll();
  const pechuga = catalogo.find((p) => p.nombre === 'Pechuga');
  const stockOriginal = Number(pechuga!.stock_actual);

  await whatsappService.atender('quiero 30 kilos de pechuga', TEL, 'PRUEBA Doble');
  await supabase.from('productos').update({ stock_actual: 2 }).eq('id', pechuga!.id);

  const sinStock = await whatsappService.atender('si porfa', TEL);
  await supabase.from('productos').update({ stock_actual: stockOriginal }).eq('id', pechuga!.id);

  revisar('no promete lo que ya no hay', sinStock.pedidoId === undefined);
  revisar('no se creo el pedido', (await contarPedidos()) === 0);
  revisar('lo explica al cliente', /se nos movio el inventario/.test(sinStock.respuesta));
  revisar('dice cuanto queda de verdad', /2 kg/.test(sinStock.respuesta), sinStock.respuesta);
  revisar('lo toma una persona', await pausado());

  // ── 8. El cliente dice que no ──────────────────────────────────────────
  await borrarConversacion();
  await borrarPedidos();
  seccion('8. "no, dejalo asi" -> el borrador se tira');

  await whatsappService.atender('quiero 9 kilos de pechuga', TEL, 'PRUEBA Doble');
  await whatsappService.atender('no, dejalo asi', TEL);
  const arrepentido = await whatsappService.atender('si', TEL);

  revisar('un "si" posterior ya no crea nada', arrepentido.pedidoId === undefined);
  revisar('la base sigue limpia', (await contarPedidos()) === 0);

  // ── 9. Despues de confirmar, ya no es un borrador ──────────────────────
  await borrarConversacion();
  await borrarPedidos();
  seccion('9. Cambiar un pedido YA confirmado sigue pasando a una persona');

  await whatsappService.atender('quiero 11 kilos de pechuga', TEL, 'PRUEBA Doble');
  const hecho = await whatsappService.atender('si porfa', TEL);
  revisar('el pedido existe', Boolean(hecho.pedidoId));

  const despues = await whatsappService.atender('mejor que sean 30 kilos', TEL);
  revisar('no se recotiza sobre un pedido real', !/Todavia no lo anoto/.test(despues.respuesta));
  revisar('no se duplica el pollo', (await contarPedidos()) === 1);
  revisar('lo toma una persona', await pausado());
  revisar('se le enseña lo que ya tiene', /11 kg/.test(despues.respuesta), despues.respuesta);

  await borrarConversacion();
  await borrarPedidos();

  console.log('');
  console.log('  ' + '='.repeat(72));
  const total = ok + fallas.length;
  console.log(`  Revisiones: ${total}   pasadas: ${ok}   fallidas: ${fallas.length}`);
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
