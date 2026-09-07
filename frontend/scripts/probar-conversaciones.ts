/**
 * Comprueba el enlace pedido-conversacion y el silencio inteligente.
 *
 * Va contra la base real porque las dos cosas viven ahi: el reparto de
 * mensajes lo hace una funcion de PostgreSQL y la pausa es una columna con
 * caducidad. Probarlo en memoria no diria nada sobre lo que pasa de verdad.
 *
 *   npm run probar:conversaciones
 */
import './cargar-env';
import { supabase } from '../server/database/supabase.client';
import { whatsappService } from '../server/modules/whatsapp/whatsapp.service';
import { conversacionDePedido } from '../server/modules/whatsapp/whatsapp.conversaciones';
import { MINUTOS_SILENCIO, reactivar, silenciar } from '../server/modules/whatsapp/whatsapp.silencio';
import { Memoria } from '../server/modules/whatsapp/whatsapp.memoria';

const TEL = '5210000000051';

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

/**
 * Mete un mensaje por el mismo camino que el webhook de Meta.
 *
 * Cada uno lleva su propio `wamid`: la deduplicacion por UNIQUE descartaria el
 * segundo si se repitiera, y la prueba veria un silencio que no existe.
 */
let n = 0;
const escribir = (texto: string) =>
  whatsappService.procesarMensaje({
    wamid: `test.conv.${Date.now()}.${n++}`,
    telefono: TEL,
    nombrePerfil: 'PRUEBA Conv',
    texto,
    tipo: 'text',
    recibidoEn: new Date()
  });

const limpiar = async (): Promise<void> => {
  const { data: cli } = await supabase.from('clientes').select('id').eq('telefono', TEL);
  const ids = (cli ?? []).map((c: { id: string }) => c.id);
  if (ids.length) {
    const { data: p } = await supabase.from('pedidos').select('id').in('cliente_id', ids);
    const pid = (p ?? []).map((x: { id: string }) => x.id);
    if (pid.length) {
      await supabase.from('pedido_detalles').delete().in('pedido_id', pid);
      await supabase.from('pedidos').delete().in('id', pid);
    }
    await supabase.from('clientes').delete().in('id', ids);
  }
  await supabase.from('conversaciones_whatsapp').delete().eq('telefono', TEL);
  await supabase.from('mensajes_whatsapp').delete().eq('telefono', TEL);
  // La cuota de IA se cuenta por telefono y por hora. Sin borrarla, dos
  // corridas seguidas de esta prueba agotan el presupuesto del numero y el
  // bot escala por 'sin_cuota' en medio de un caso que probaba otra cosa.
  await supabase.from('ia_peticiones').delete().eq('telefono', TEL);
};

const main = async (): Promise<void> => {
  await limpiar();

  // ── 1. Cada pedido se queda con SUS mensajes ─────────────────────────
  seccion('1. Dos pedidos del mismo cliente, con dias de por medio');

  // Se usa `procesarMensaje` y no `atender`: es el camino real del webhook, y
  // es el unico que guarda el mensaje del cliente y hace el enlace. Con
  // `atender` la prueba daria cero mensajes enlazados y la culpa seria de la
  // prueba, no del sistema.
  await escribir('hola buenas');

  // Dos mensajes por pedido: el dictado y el "si". Desde la doble
  // confirmacion el pedido nace en el segundo, y es ese el que trae el id.
  const dictado = await escribir('20 kilos de pechuga');
  revisar('el dictado todavia no crea el pedido', !dictado.pedidoId);
  const primero = await escribir('si porfa');
  revisar('el primer pedido se crea al confirmar', Boolean(primero.pedidoId), (primero.respuesta ?? '').slice(0, 50));

  const hilo1 = primero.pedidoId ? await conversacionDePedido(primero.pedidoId) : [];
  revisar('se le enlazan sus mensajes', hilo1.length >= 5, `${hilo1.length} mensajes`);
  revisar(
    'incluye lo que escribio el cliente',
    hilo1.some((m) => m.tipo === 'cliente' && m.texto.includes('20 kilos')),
  );
  revisar(
    'y la confirmacion del bot',
    hilo1.some((m) => m.tipo === 'bot' && m.texto.includes('ya se lo anote'))
  );

  await escribir('ahora 10 kilos de pierna');
  const segundo = await escribir('si porfa');
  revisar('el segundo pedido se crea', Boolean(segundo.pedidoId));

  const hilo2 = segundo.pedidoId ? await conversacionDePedido(segundo.pedidoId) : [];
  revisar('el segundo tiene su propia conversacion', hilo2.length >= 2, `${hilo2.length} mensajes`);
  revisar(
    'y NO se lleva los mensajes del primero',
    !hilo2.some((m) => m.texto.includes('20 kilos')),
    hilo2.map((m) => m.texto.slice(0, 25)).join(' | ')
  );

  const hilo1Otra = primero.pedidoId ? await conversacionDePedido(primero.pedidoId) : [];
  revisar(
    'el primero conserva los suyos',
    hilo1Otra.length === hilo1.length,
    `antes ${hilo1.length}, ahora ${hilo1Otra.length}`
  );

  // ── 2. El silencio ────────────────────────────────────────────────────
  seccion('2. El bot se calla cuando una persona toma el chat');

  await silenciar(TEL, MINUTOS_SILENCIO.intervencion, false);
  let m = await Memoria.cargar(TEL);
  revisar('queda callado tras responder desde el panel', m.pausada);

  const durante = await escribir('y cuanto seria de muslo?');
  revisar('no contesta mientras esta callado', !durante.respuesta);

  const { data: marcas } = await supabase
    .from('mensajes_whatsapp')
    .select('mensaje')
    .eq('telefono', TEL)
    .eq('tipo', 'sistema');
  revisar(
    'pero deja constancia del intento (modo sombra)',
    (marcas ?? []).some((x: { mensaje: string }) => x.mensaje.includes('[ATENCION]'))
  );

  revisar('se puede devolver el chat al bot', await reactivar(TEL));
  m = await Memoria.cargar(TEL);
  revisar('y deja de estar callado', !m.pausada);

  const despues = await escribir('a como esta la pechuga?');
  revisar('el bot vuelve a contestar', Boolean(despues.respuesta));

  // ── 3. La pausa caduca sola ───────────────────────────────────────────
  seccion('3. La pausa caduca sola (nadie se acuerda de reactivar)');

  // Se silencia con duracion negativa: equivale a una pausa ya vencida.
  await silenciar(TEL, -1, false);
  m = await Memoria.cargar(TEL);
  revisar('una pausa vencida NO calla al bot', !m.pausada);

  const traCaducar = await escribir('me das 5 kilos de ala?');
  revisar('y vuelve a cotizar', /Total:/.test(traCaducar.respuesta ?? ''), traCaducar.respuesta);
  const traConfirmar = await escribir('si porfa');
  revisar('y vuelve a tomar pedidos', Boolean(traConfirmar.pedidoId));

  // ── 4. Escalar calla Y deja en la bandeja ────────────────────────────
  seccion('4. Un reclamo hace las dos cosas');

  await escribir('me llego el pollo echado a perder');

  const { data: conv } = await supabase
    .from('conversaciones_whatsapp')
    .select('estado, pausado_hasta, contexto')
    .eq('telefono', TEL)
    .maybeSingle();

  revisar('entra en la bandeja', conv?.estado === 'escalado_humano');
  revisar('y calla al bot', Boolean(conv?.pausado_hasta));

  const horas = conv?.pausado_hasta
    ? Math.round((new Date(conv.pausado_hasta as string).getTime() - Date.now()) / 3_600_000)
    : 0;
  revisar('durante ~12 horas, no 2', horas >= 11 && horas <= 12, `${horas} h`);
  revisar(
    'con el motivo conservado',
    (conv?.contexto as { motivo?: string })?.motivo === 'queja',
    `motivo: ${(conv?.contexto as { motivo?: string })?.motivo}`
  );

  await limpiar();

  console.log('');
  console.log('  ' + '='.repeat(70));
  console.log(`  Revisiones: ${ok + fallas.length}   pasadas: ${ok}   fallidas: ${fallas.length}`);
  if (fallas.length) for (const f of fallas) console.log(`   - ${f}`);
  process.exit(fallas.length ? 1 : 0);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
