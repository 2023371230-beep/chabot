import { supabase } from '../../database/supabase.client';
import { clientesService } from '../clientes/clientes.service';
import { pedidosService } from '../pedidos/pedidos.service';
import { productosService } from '../productos/productos.service';
import { formatCurrency, formatKg } from '../../shared/utils/format.utils';
import { pasarAPersona } from './whatsapp.handoff';
import { firmaPedido, Memoria, type Renglon } from './whatsapp.memoria';
import { armarCotizacion, proponerBorrador, revisarStock } from './whatsapp.borrador';
import { avisoFueraDeHorario } from './whatsapp.informacion';
import type { Atencion, PedidoDelCliente } from './whatsapp.types';

/**
 * Donde un borrador se vuelve un pedido de verdad.
 *
 * Es el unico punto del modulo que escribe en la tabla de pedidos, y solo se
 * llega desde un "si" del cliente. Tener un unico camino hacia la escritura
 * es lo que hace que la promesa "ningun pedido sin confirmar" se pueda
 * comprobar leyendo un archivo, en vez de auditando doce.
 */

/** Los pedidos recientes de un telefono, del mas nuevo al mas viejo. */
export async function pedidosDelCliente(telefono: string, limite: number): Promise<PedidoDelCliente[]> {
  const cliente = await clientesService.findByPhone(telefono);
  if (!cliente) return [];

  const { data, error } = await supabase
    .from('pedidos')
    .select('*, pedido_detalles(*, productos(*))')
    .eq('cliente_id', cliente.id)
    .order('created_at', { ascending: false })
    .limit(limite);

  if (error) {
    console.error('[whatsapp] no se pudieron leer los pedidos:', error.message);
    return [];
  }

  return (data ?? []) as PedidoDelCliente[];
}


// ── Piezas compartidas ────────────────────────────────────────────────

/**
 * Crea el pedido, con la ultima red contra los duplicados.
 *
 * Es el unico punto del modulo donde nace un pedido, y solo se llega aqui
 * desde un "si" del cliente. La red de duplicados sigue haciendo falta: dos
 * "si" muy seguidos llegan como dos mensajes distintos, y el segundo ya no
 * encuentra el borrador pero si podria encontrar el camino hasta aqui.
 */
export async function crearPedido(params: {
  telefono: string;
  memoria: Memoria;
  nombrePerfil?: string;
  renglones: Renglon[];
  catalogo?: Awaited<ReturnType<typeof productosService.findAll>>;
  fechaEntrega?: string;
  notas?: string;
  saludo: string | null;
}): Promise<Atencion> {
  const { telefono, memoria, nombrePerfil, renglones, fechaEntrega, notas, saludo } = params;
  const firma = firmaPedido(renglones);

  const repetido = memoria.pedidoDuplicado(firma);
  if (repetido) {
    return {
      respuesta: `Ese pedido ya me lo habia anotado, no se preocupe. Se lo repito:\n\n${repetido}`
    };
  }

  try {
    const { pedido, warnings } = await pedidosService.createOrder({
      cliente: { telefono, nombre: nombrePerfil },
      fecha_entrega: fechaEntrega,
      origen: 'whatsapp',
      notas,
      productos: renglones,
      catalogo: params.catalogo
    });

    let resumen = componerResumen(pedido, warnings, saludo);

    // El pedido se toma igual fuera de horario; solo se avisa. Rechazarlo
    // por la hora seria regalar la venta a quien escribe de noche.
    const fueraDeHorario = await avisoFueraDeHorario();
    if (fueraDeHorario) resumen = `${resumen}\n\n${fueraDeHorario}`;

    memoria.recordarPedido(firma, resumen);
    return { respuesta: resumen, pedidoId: pedido.id };
  } catch (e) {
    const detalle = e instanceof Error ? e.message : 'Error desconocido';
    console.error('[whatsapp] no se pudo crear el pedido:', detalle);
    return {
      respuesta: 'No pude registrar tu pedido en este momento. Intenta de nuevo en un rato.'
    };
  }
}


/**
 * "Si, apartamelo": el segundo paso de la doble confirmacion.
 *
 * Aqui, y solo aqui, nace el pedido. Se crea con los renglones que YA se
 * habian resuelto al cotizar: ni una peticion de IA mas, y cero riesgo de
 * que el modelo entienda otra cosa la segunda vez.
 *
 * Entre la cotizacion y el "si" pudo pasar media hora, y el mundo se mueve
 * en ese rato: el stock baja y los precios cambian. Por eso el borrador se
 * revisa contra los numeros de AHORA antes de convertirlo en pedido.
 */
export async function atenderConfirmacion(
  telefono: string,
  memoria: Memoria,
  nombrePerfil?: string,
  texto?: string
): Promise<Atencion> {
  const borrador = memoria.tomarCotizacion();

  if (!borrador) {
    // Un "va" o un "sale" sueltos son solo un acuse de recibo.
    return { respuesta: 'Perfecto. Cualquier cosa aqui ando.' };
  }

  const catalogo = await productosService.findAll();

  // Un "si" que llega tarde confirma un total que ya puede no ser el de hoy.
  // Se vuelve a cotizar con los precios de ahora y se pregunta otra vez: un
  // mensaje de mas es mas barato que cobrar sobre un precio viejo.
  if (borrador.vencida) {
    memoria.recordarCotizacion(borrador.renglones, {
      fechaEntrega: borrador.fechaEntrega,
      notas: borrador.notas
    });
    return {
      respuesta: armarCotizacion(
        borrador.renglones,
        catalogo,
        'Paso un rato desde que le pase el precio. Se lo reviso con los de hoy:',
        { fechaEntrega: borrador.fechaEntrega }
      )
    };
  }

  // El stock pudo moverse mientras el cliente lo pensaba. Confirmar a ciegas
  // convertiria el borrador en una promesa que la bodega no puede cumplir.
  const faltante = revisarStock(borrador.renglones, catalogo);
  if (faltante.detalle.length) {
    const handoff = await pasarAPersona({
      telefono,
      memoria,
      motivo: 'sin_stock',
      detalle: `Al confirmar ya no alcanzaba: ${faltante.detalle.join('; ')}`,
      nombrePerfil,
      texto
    });
    return {
      respuesta: [
        'Mientras lo pensaba se nos movio el inventario.',
        `${faltante.paraElCliente.join('\n')}.`,
        '',
        handoff.respuesta
      ].join('\n')
    };
  }

  return crearPedido({
    telefono,
    memoria,
    nombrePerfil,
    renglones: borrador.renglones,
    catalogo,
    fechaEntrega: borrador.fechaEntrega,
    notas: borrador.notas,
    saludo: null
  });
}


/** "Lo de siempre": se lee el ultimo pedido en vez de inventarlo. */
export async function atenderRepetir(
  telefono: string,
  memoria: Memoria,
  saludo: string
): Promise<Atencion> {
  const [ultimo] = await pedidosDelCliente(telefono, 1);

  if (!ultimo?.pedido_detalles?.length) {
    return {
      respuesta: `${saludo}! Todavia no tengo un pedido anterior suyo. Digame que corte necesita y cuantos kilos.`
    };
  }

  const renglones: Renglon[] = ultimo.pedido_detalles.map((d) => ({
    producto_id: d.producto_id,
    kg: Number(d.kg)
  }));

  // Se cotiza con los precios de hoy, no con los que pago la vez pasada: el
  // pedido es igual, el precio no tiene por que serlo.
  const catalogo = await productosService.findAll();

  return proponerBorrador({
    telefono,
    memoria,
    renglones,
    catalogo,
    encabezado: `${saludo}! Su ultimo pedido fue asi:`
  });
}

/**
 * El acuse del pedido ya creado.
 *
 * El cliente acaba de decir que si, asi que la primera linea confirma que se
 * anoto — no repetir esa confirmacion es lo que hace que vuelva a escribir
 * "quedo?" cinco minutos despues.
 *
 * Y cierra diciendo que falta el visto bueno del negocio, porque es verdad: el
 * pedido nace en estado pendiente y el stock todavia no se movio. Callarlo
 * haria que el cliente cuente con mercancia que nadie ha apartado.
 */
type PedidoResumen = {
  id: string;
  total_kg: number | string;
  total_precio: number | string;
  fecha_entrega: string | null;
  pedido_detalles?: Array<{
    kg: number | string;
    productos?: { nombre?: string } | null;
  }>;
};

function componerResumen(
  pedido: PedidoResumen,
  warnings: string[],
  saludo: string | null
): string {
  // Si el cliente saludo, se le devuelve el saludo: cuesta cero y cambia por
  // completo como se siente el trato.
  const lineas: string[] = saludo
    ? [`${saludo}! Listo, ya se lo anote:`]
    : ['Listo, ya se lo anote:'];

  for (const d of pedido.pedido_detalles ?? []) {
    lineas.push(`  ${formatKg(d.kg)} de ${d.productos?.nombre ?? 'producto'}`);
  }

  lineas.push('');
  lineas.push(`Total: ${formatKg(pedido.total_kg)} — ${formatCurrency(pedido.total_precio)}`);

  if (pedido.fecha_entrega) {
    lineas.push(`Entrega: ${pedido.fecha_entrega}`);
  }

  const stock = warnings.filter((w) => w.toLowerCase().includes('stock'));
  const otros = warnings.filter((w) => !w.toLowerCase().includes('stock'));

  if (stock.length) {
    lineas.push('');
    lineas.push('Puede que no tengamos todo lo que pidio; se lo confirmamos en un momento.');
  }

  if (otros.length) {
    lineas.push('');
    for (const w of otros) lineas.push(w);
  }

  lineas.push('');
  lineas.push('Queda anotado. En cuanto le demos salida en el mostrador le avisamos.');

  return lineas.join('\n');
}
