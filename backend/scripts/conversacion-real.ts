/**
 * Conversacion de punta a punta contra la base y contra Groq de verdad.
 *
 * Llama al servicio directamente (no por HTTP) para NO mandar mensajes al
 * WhatsApp del dueño: lo que se prueba es la decision, no el envio, que ya
 * quedo probado aparte.
 *
 * Mide cuantas peticiones de Groq consumio la conversacion completa leyendo
 * las cabeceras reales de rate limit antes y despues.
 *
 * Los pedidos que cree los borra al final, por id, para no dejar basura.
 *
 *   npx tsx scripts/conversacion-real.ts
 */
import 'dotenv/config';
import { supabase } from '../src/database/supabase.client';
import { whatsappService } from '../src/modules/whatsapp/whatsapp.service';
import { olvidarTodo } from '../src/modules/whatsapp/whatsapp.memoria';
import {
  estadoPresupuesto,
  reiniciarPresupuesto
} from '../src/modules/whatsapp/whatsapp.presupuesto';

const TEL = '5210000000001';

const conversacion: Array<{ dice: string; nota?: string }> = [
  { dice: 'buenas tardes' },
  { dice: 'que tienen?' },
  { dice: 'cuanto cuesta el kilo de pechuga?' },
  { dice: 'cuanto me sale 20 kilos de pechuga', nota: 'cotizacion: no debe crear pedido' },
  { dice: 'si porfa', nota: 'confirma la cotizacion SIN volver a usar IA' },
  { dice: 'si porfa', nota: 'segundo si: no debe duplicar' },
  { dice: 'ya esta listo mi pedido?', nota: 'se contesta de la base' },
  { dice: 'oiga mejor que sean 30 kilos', nota: 'modificacion: no debe crear otro pedido' },
  { dice: 'cancela mi pedido', nota: 'cancela el pendiente' },
  { dice: '\u{1F44D}', nota: 'no debe contestar nada' },
  { dice: 'me llego mal el pedido, faltaron 3 kilos', nota: 'queja: va a una persona' },
  { dice: 'gracias' }
];

const main = async (): Promise<void> => {
  olvidarTodo();
  reiniciarPresupuesto();

  const creados: string[] = [];

  console.log('');
  console.log('  ' + '='.repeat(74));

  for (const paso of conversacion) {
    const { respuesta, pedidoId } = await whatsappService.atender(paso.dice, TEL, 'PRUEBA Bot');
    if (pedidoId) creados.push(pedidoId);

    console.log('');
    console.log(`  CLIENTE > ${paso.dice}`);
    if (paso.nota) console.log(`            (${paso.nota})`);
    if (!respuesta) {
      console.log('  BOT     > [no contesta, correcto]');
    } else {
      for (const l of respuesta.split('\n')) console.log(`  BOT     > ${l}`);
    }
    if (pedidoId) console.log(`  ** pedido creado: ${pedidoId}`);
  }

  const gasto = estadoPresupuesto();
  console.log('');
  console.log('  ' + '='.repeat(74));
  console.log(`  Mensajes en la conversacion:   ${conversacion.length}`);
  console.log(`  Peticiones de IA consumidas:   ${gasto.usadasHoy}`);
  console.log(`  Resueltos sin IA:              ${conversacion.length - gasto.usadasHoy}`);
  console.log(`  Pedidos creados:               ${creados.length}`);

  if (creados.length) {
    await supabase.from('pedido_detalles').delete().in('pedido_id', creados);
    const { error } = await supabase.from('pedidos').delete().in('id', creados);
    console.log(
      error
        ? `  Limpieza FALLIDA: ${error.message} — borra a mano ${creados.join(', ')}`
        : `  Limpieza: borrados ${creados.join(', ')}`
    );
  }

  // Los mensajes de la conversacion de prueba tambien se van.
  await supabase.from('mensajes_whatsapp').delete().eq('telefono', TEL);
};

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
