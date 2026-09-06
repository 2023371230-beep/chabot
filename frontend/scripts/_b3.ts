import './cargar-env';
import { supabase } from '../server/database/supabase.client';
import { whatsappService } from '../server/modules/whatsapp/whatsapp.service';
import { listarPendientes, reanudar } from '../server/modules/whatsapp/whatsapp.handoff';
const TEL = '5210000000031';
const limpiar = async () => {
  await supabase.from('conversaciones_whatsapp').delete().eq('telefono', TEL);
  await supabase.from('mensajes_whatsapp').delete().eq('telefono', TEL);
};
(async () => {
  await limpiar();
  console.log('  CASO A: cliente que YA tenia conversacion abierta');
  await whatsappService.atender('hola', TEL, 'PRUEBA B3');
  await whatsappService.atender('me das descuento si llevo 100 kilos?', TEL, 'PRUEBA B3');
  let p = (await listarPendientes()).find((x) => x.telefono === TEL);
  console.log(`    motivo:  ${p?.motivo}   ${p?.motivo === 'negociacion' ? 'OK' : 'FALLA'}`);
  console.log(`    mensaje: ${p?.ultimoMensaje ? 'conservado OK' : 'PERDIDO'}`);
  console.log(`    nombre:  ${p?.nombreCliente ?? '(vacio)'}`);
  const sigue = await whatsappService.atender('entonces mandame 20 kilos', TEL);
  console.log(`    el bot se calla despues: ${sigue.respuesta === '' ? 'OK' : 'FALLA'}`);

  await reanudar(TEL);
  await limpiar();

  console.log('  CASO B: cliente nuevo, sin conversacion previa');
  await whatsappService.atender('son unos rateros', TEL, 'PRUEBA B3');
  p = (await listarPendientes()).find((x) => x.telefono === TEL);
  console.log(`    motivo:  ${p?.motivo}   ${p?.motivo === 'enojo' ? 'OK' : 'FALLA'}`);
  console.log(`    mensaje: ${p?.ultimoMensaje ? 'conservado OK' : 'PERDIDO'}`);
  await reanudar(TEL);
  await limpiar();
  process.exit(0);
})();
