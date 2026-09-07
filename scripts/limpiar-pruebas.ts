/**
 * Borra los datos que dejan los simuladores.
 *
 * Todos usan telefonos que empiezan por 52100000000, que nunca va a ser un
 * cliente real. Correrlo de mas no hace daño.
 *
 *   npm run limpiar:pruebas
 */
import './cargar-env';
import { supabase } from '../server/database/supabase.client';

const PREFIJO = '52100000000';

const main = async (): Promise<void> => {
  const { data: cli } = await supabase
    .from('clientes')
    .select('id, telefono')
    .like('telefono', `${PREFIJO}%`);

  const ids = (cli ?? []).map((c: { id: string }) => c.id);
  let pedidosBorrados = 0;

  if (ids.length) {
    const { data: peds } = await supabase.from('pedidos').select('id').in('cliente_id', ids);
    const pids = (peds ?? []).map((p: { id: string }) => p.id);
    if (pids.length) {
      await supabase.from('pedido_detalles').delete().in('pedido_id', pids);
      await supabase.from('pedidos').delete().in('id', pids);
      pedidosBorrados = pids.length;
    }
    await supabase.from('clientes').delete().in('id', ids);
  }

  await supabase.from('conversaciones_whatsapp').delete().like('telefono', `${PREFIJO}%`);
  await supabase.from('mensajes_whatsapp').delete().like('telefono', `${PREFIJO}%`);
  await supabase.from('ia_peticiones').delete().like('telefono', `${PREFIJO}%`);

  console.log(
    `limpiado: ${ids.length} clientes, ${pedidosBorrados} pedidos y sus mensajes de prueba`
  );
  process.exit(0);
};

void main();
