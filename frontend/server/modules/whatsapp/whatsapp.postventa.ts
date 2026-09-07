import { pedidosService } from '../pedidos/pedidos.service';
import { formatCurrency, formatKg } from '../../shared/utils/format.utils';
import { pasarAPersona } from './whatsapp.handoff';
import { Memoria } from './whatsapp.memoria';
import { pedidosDelCliente } from './whatsapp.pedido';
import { atenderConIA, corregirBorrador } from './whatsapp.borrador';
import type { Atencion } from './whatsapp.types';

/**
 * Lo que pasa DESPUES de que el pedido existe.
 *
 * Cancelar, cambiar y preguntar por el estado se parecen a tomar un pedido y
 * no lo son: aqui ya se movio inventario y ya se le prometio algo a alguien.
 * Por eso ninguna de estas ramas llega a la IA — el modelo leeria "30 kilos"
 * en "mejor que sean 30" y crearia un SEGUNDO pedido encima del primero.
 */

// ── Ramas que no gastan IA ────────────────────────────────────────────

/**
 * Cancelaciones.
 *
 * Solo se cancela solo lo que todavia esta PENDIENTE: ahi no se movio stock
 * ni se preparo nada, y deshacerlo no cuesta. Un pedido ya confirmado si
 * toco inventario, y esa decision no la toma un bot.
 */
export async function atenderCancelacion(
  telefono: string,
  memoria: Memoria,
  nombrePerfil?: string,
  texto?: string
): Promise<Atencion> {
  const [ultimo] = await pedidosDelCliente(telefono, 1);

  if (!ultimo) {
    return {
      respuesta:
        'No encuentro ningun pedido suyo abierto. Si quiere hacer uno, digame el corte y los kilos.'
    };
  }

  if (ultimo.estado === 'cancelado') {
    return {
      respuesta: 'Ese pedido ya estaba cancelado. No se preocupe, no se le va a cobrar nada.'
    };
  }

  // Un pedido confirmado ya movio inventario: deshacerlo no es reversible
  // solo, hace falta un ajuste manual. Esa decision no la toma un bot.
  //
  // Y como al cliente se le dice que lo vera una persona, TIENE que pasar de
  // verdad: antes estas dos ramas prometian al encargado y no le avisaban a
  // nadie. Una promesa que el sistema no cumple es peor que negarse.
  if (ultimo.estado !== 'pendiente') {
    const handoff = await pasarAPersona({
      telefono,
      memoria,
      motivo: 'modificacion',
      detalle: `Pide cancelar un pedido ya ${ultimo.estado} de ${formatKg(ultimo.total_kg)} (${formatCurrency(ultimo.total_precio)})`,
      nombrePerfil,
      texto
    });
    return {
      respuesta: `Su pedido de ${formatKg(ultimo.total_kg)} ya esta ${ultimo.estado} y ya se preparo. ${handoff.respuesta}`
    };
  }

  try {
    await pedidosService.updateOrderStatus(ultimo.id, 'cancelado');
    return {
      respuesta: `Listo, cancele su pedido de ${formatKg(ultimo.total_kg)} por ${formatCurrency(ultimo.total_precio)}. No se le cobra nada. Cuando guste hacemos otro.`
    };
  } catch (e) {
    console.error('[whatsapp] no se pudo cancelar:', e instanceof Error ? e.message : e);
    const handoff = await pasarAPersona({
      telefono,
      memoria,
      motivo: 'modificacion',
      detalle: `Fallo la cancelacion automatica del pedido ${ultimo.id}`,
      nombrePerfil,
      texto
    });
    return { respuesta: `No pude cancelarlo automaticamente. ${handoff.respuesta}` };
  }
}


/**
 * "Mejor que sean 30 y no 20".
 *
 * Hay dos casos que parecen el mismo y no lo son:
 *
 * · Sobre un BORRADOR sin confirmar no se ha creado nada, no se movio
 *   inventario y no se le prometio nada a nadie. Cambiarlo es gratis: se
 *   vuelve a cotizar y el borrador nuevo pisa al viejo. Escalar esto seria
 *   llamar a una persona porque el cliente se corrigio a si mismo.
 *
 * · Sobre un PEDIDO ya creado es donde mas facil se duplica el pollo: si
 *   llegara a la IA, extraeria "30 kilos" y crearia un SEGUNDO pedido encima
 *   del de 20. Se le muestra al cliente lo que tiene y lo toma una persona.
 */
export async function atenderModificacion(
  texto: string,
  telefono: string,
  memoria: Memoria,
  saludo: string,
  nombrePerfil?: string
): Promise<Atencion> {
  const borrador = memoria.verBorrador();
  if (borrador) {
    const corregido = await corregirBorrador(texto, telefono, memoria, borrador, nombrePerfil);
    if (corregido) return corregido;
    return atenderConIA(texto, telefono, memoria, nombrePerfil, saludo, false);
  }

  const [ultimo] = await pedidosDelCliente(telefono, 1);

  if (!ultimo) {
    // Sin pedido previo no hay nada que cambiar: es un pedido nuevo mal
    // escrito, y eso si lo puede tomar el bot.
    return {
      respuesta:
        'No tengo ningun pedido suyo para cambiar. Digame de nuevo el corte y los kilos y se lo anoto.'
    };
  }

  const actual = (ultimo.pedido_detalles ?? [])
    .map((d) => `${formatKg(d.kg)} de ${d.productos?.nombre ?? 'producto'}`)
    .join(', ');

  const handoff = await pasarAPersona({
    telefono,
    memoria,
    motivo: 'modificacion',
    detalle: `Pedido actual: ${actual} (${formatCurrency(ultimo.total_precio)})`,
    nombrePerfil,
    texto
  });

  // Se le muestra lo que tiene antes de pasarlo: asi el cliente sabe sobre
  // que se esta hablando y el asesor no empieza de cero.
  return {
    respuesta: [
      'Su pedido ahorita esta asi:',
      '',
      ...(ultimo.pedido_detalles ?? []).map(
        (d) => `  ${formatKg(d.kg)} de ${d.productos?.nombre ?? 'producto'}`
      ),
      '',
      `Total: ${formatKg(ultimo.total_kg)} — ${formatCurrency(ultimo.total_precio)}`,
      '',
      handoff.respuesta
    ].join('\n')
  };
}


/** "Ya esta listo mi pedido?" se contesta de la base, no con IA. */
export async function atenderEstado(telefono: string): Promise<string> {
  const [ultimo] = await pedidosDelCliente(telefono, 1);

  if (!ultimo) {
    return 'No encuentro pedidos suyos. Si quiere hacer uno, digame el corte y los kilos.';
  }

  const detalle = (ultimo.pedido_detalles ?? [])
    .map((d) => `${formatKg(d.kg)} de ${d.productos?.nombre ?? 'producto'}`)
    .join(', ');

  const entrega = ultimo.fecha_entrega ? ` Entrega: ${ultimo.fecha_entrega}.` : '';

  const estados: Record<string, string> = {
    pendiente: 'esta anotado y falta confirmarlo',
    confirmado: 'ya esta confirmado y en preparacion',
    completado: 'ya se entrego',
    cancelado: 'esta cancelado'
  };

  return `Su pedido de ${detalle} ${estados[ultimo.estado] ?? ultimo.estado}.${entrega}`;
}
