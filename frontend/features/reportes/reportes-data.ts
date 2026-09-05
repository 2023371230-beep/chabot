import type { InventarioResumen, Pedido } from '@/types/models';

export type Periodo = 'mes' | 'mes_pasado' | 'trimestre' | 'todo';

export const PERIODOS: { valor: Periodo; etiqueta: string; explica: string }[] = [
  { valor: 'mes', etiqueta: 'Este mes', explica: 'Del dia 1 a hoy' },
  { valor: 'mes_pasado', etiqueta: 'Mes pasado', explica: 'El mes completo anterior' },
  { valor: 'trimestre', etiqueta: 'Ultimos 90 dias', explica: 'Los 90 dias anteriores a hoy' },
  { valor: 'todo', etiqueta: 'Todo', explica: 'Desde que arranco el sistema' }
];

/** Rango [desde, hasta) del periodo, y el rango anterior del mismo largo. */
export function rangos(periodo: Periodo) {
  const ahora = new Date();
  let desde: Date;
  let hasta = new Date(ahora);

  if (periodo === 'mes') {
    desde = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  } else if (periodo === 'mes_pasado') {
    desde = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
    hasta = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  } else if (periodo === 'trimestre') {
    desde = new Date(ahora);
    desde.setDate(desde.getDate() - 90);
  } else {
    desde = new Date(0);
  }

  const largo = hasta.getTime() - desde.getTime();
  return {
    desde,
    hasta,
    // Periodo anterior del mismo largo, para poder comparar contra algo.
    previoDesde: new Date(desde.getTime() - largo),
    previoHasta: desde
  };
}

const enRango = (p: Pedido, desde: Date, hasta: Date) => {
  const f = new Date(p.created_at);
  return f >= desde && f < hasta;
};

/** Solo confirmados y entregados son dinero real: un pendiente aun no vendio. */
const vendidos = (pedidos: Pedido[]) =>
  pedidos.filter((p) => p.estado === 'confirmado' || p.estado === 'completado');

export type FilaProducto = { nombre: string; kg: number; ingreso: number };
export type FilaCliente = { nombre: string; telefono: string; pedidos: number; ingreso: number };

export function calcular(pedidos: Pedido[], inventario: InventarioResumen[], periodo: Periodo) {
  const { desde, hasta, previoDesde, previoHasta } = rangos(periodo);

  const delPeriodo = pedidos.filter((p) => enRango(p, desde, hasta));
  const delPrevio = pedidos.filter((p) => enRango(p, previoDesde, previoHasta));

  const v = vendidos(delPeriodo);
  const vPrev = vendidos(delPrevio);

  const suma = (lista: Pedido[], campo: 'total_precio' | 'total_kg') =>
    lista.reduce((a, p) => a + Number(p[campo] ?? 0), 0);

  const ingreso = suma(v, 'total_precio');
  const ingresoPrev = suma(vPrev, 'total_precio');
  const kg = suma(v, 'total_kg');
  const kgPrev = suma(vPrev, 'total_kg');

  // Producto
  const porProducto = new Map<string, FilaProducto>();
  for (const pedido of v) {
    for (const d of pedido.pedido_detalles ?? []) {
      const nombre = d.productos?.nombre ?? 'Sin nombre';
      const f = porProducto.get(nombre) ?? { nombre, kg: 0, ingreso: 0 };
      f.kg += Number(d.kg ?? 0);
      f.ingreso += Number(d.subtotal ?? 0);
      porProducto.set(nombre, f);
    }
  }

  // Cliente
  const porCliente = new Map<string, FilaCliente>();
  for (const pedido of v) {
    const tel = pedido.clientes?.telefono ?? pedido.cliente?.telefono ?? '—';
    const f = porCliente.get(tel) ?? {
      nombre: pedido.clientes?.nombre ?? pedido.cliente?.nombre ?? 'Cliente',
      telefono: tel,
      pedidos: 0,
      ingreso: 0
    };
    f.pedidos += 1;
    f.ingreso += Number(pedido.total_precio ?? 0);
    porCliente.set(tel, f);
  }

  const cancelados = delPeriodo.filter((p) => p.estado === 'cancelado').length;

  // Mermas: el inventario no guarda fecha por movimiento en el resumen, asi
  // que este bloque es historico total, no del periodo. Se etiqueta como tal
  // en la interfaz para no dar a entender lo que no es.
  const merma = inventario.reduce(
    (acc, i) => {
      const kgMerma = Number(i.total_mermas ?? 0);
      return {
        kg: acc.kg + kgMerma,
        dinero: acc.dinero + kgMerma * Number(i.precio_kg ?? 0)
      };
    },
    { kg: 0, dinero: 0 }
  );

  const variacion = (actual: number, previo: number) =>
    previo > 0 ? ((actual - previo) / previo) * 100 : null;

  return {
    desde,
    hasta,
    ingreso,
    kg,
    pedidos: v.length,
    ticket: v.length ? ingreso / v.length : 0,
    varIngreso: variacion(ingreso, ingresoPrev),
    varKg: variacion(kg, kgPrev),
    varPedidos: variacion(v.length, vPrev.length),
    productos: Array.from(porProducto.values()).sort((a, b) => b.ingreso - a.ingreso),
    clientes: Array.from(porCliente.values()).sort((a, b) => b.ingreso - a.ingreso),
    cancelados,
    totalPeriodo: delPeriodo.length,
    merma,
    hayPrevio: vPrev.length > 0
  };
}
