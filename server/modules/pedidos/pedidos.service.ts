import { supabase } from '../../database/supabase.client';
import { AppError } from '../../shared/errors/AppError';
import { daysBetweenTodayAnd } from '../../shared/utils/date.utils';
import { roundMoney, toNumber } from '../../shared/utils/numbers.utils';
import { clientesService } from '../clientes/clientes.service';
import { configuracionService } from '../configuracion/configuracion.service';
import { inventarioService } from '../inventario/inventario.service';
import type { Producto } from '../productos/productos.types';
import type {
  CreatePedidoInput,
  Pedido,
  PedidoDetalle,
  PedidoEstado,
  PedidoProductoInput,
  UpdatePedidoInput
} from './pedidos.types';

const PEDIDOS_TABLE = 'pedidos';
const DETALLES_TABLE = 'pedido_detalles';

type CalculatedOrder = {
  detalles: Array<{
    producto_id: string;
    kg: number;
    precio_kg: number;
    costo_kg: number;
    subtotal: number;
  }>;
  totalKg: number;
  totalPrecio: number;
  stockWarnings: string[];
};

const normalizeProductos = (productos: PedidoProductoInput[]): PedidoProductoInput[] => {
  const grouped = new Map<string, number>();

  for (const producto of productos) {
    grouped.set(
      producto.producto_id,
      roundMoney((grouped.get(producto.producto_id) ?? 0) + producto.kg)
    );
  }

  return Array.from(grouped.entries()).map(([producto_id, kg]) => ({
    producto_id,
    kg
  }));
};

/**
 * Prepara un renglon para guardarlo.
 *
 * Omite `costo_kg` cuando vale 0, y no es un rodeo: 0 significa "no se ha
 * capturado el costo", que es exactamente lo que expresa dejar que la columna
 * tome su valor por defecto. De paso, el pedido se sigue creando en una base
 * donde la columna todavia no existe — un despliegue de codigo por delante de
 * su migracion no puede tumbar la funcion principal del sistema.
 */
const aRenglon = (detalle: CalculatedOrder['detalles'][number], pedidoId: string) => {
  const { costo_kg, ...resto } = detalle;
  return {
    pedido_id: pedidoId,
    ...resto,
    ...(costo_kg > 0 ? { costo_kg } : {})
  };
};

const getProductosByIds = async (ids: string[]): Promise<Producto[]> => {
  const { data, error } = await supabase.from('productos').select('*').in('id', ids);

  if (error) {
    throw new AppError('No se pudieron validar los productos del pedido', 500, [error]);
  }

  return data ?? [];
};

/**
 * Calcula el pedido: precios, totales y avisos de stock.
 *
 * `catalogo` es opcional y sirve para no releer los productos cuando quien
 * llama YA los tiene en memoria. El bot de WhatsApp los carga para resolver
 * los nombres que dijo el cliente y para revisar el stock; sin este parametro,
 * crear el pedido volvia a pedir la misma tabla — un viaje de red entero
 * desperdiciado en cada pedido que entra por el chat.
 *
 * El dashboard sigue llamando sin el y no cambia nada.
 */
const calculateOrder = async (
  productosInput: PedidoProductoInput[],
  catalogo?: Producto[]
): Promise<CalculatedOrder> => {
  const normalized = normalizeProductos(productosInput);
  const products =
    catalogo ?? (await getProductosByIds(normalized.map((item) => item.producto_id)));
  const productMap = new Map(products.map((producto) => [producto.id, producto]));

  const detalles: CalculatedOrder['detalles'] = [];
  const stockWarnings: string[] = [];

  for (const item of normalized) {
    const producto = productMap.get(item.producto_id);

    if (!producto) {
      throw new AppError(`Producto no encontrado: ${item.producto_id}`, 404);
    }

    if (!producto.activo) {
      throw new AppError(`Producto inactivo: ${producto.nombre}`, 400);
    }

    const precioKg = toNumber(producto.precio_kg);
    // El costo se copia AHORA, igual que el precio. Calcular la ganancia
    // contra el costo actual haria que subir el costo hoy reescribiera la
    // ganancia de todos los pedidos anteriores.
    const costoKg = toNumber(producto.costo_kg);
    const subtotal = roundMoney(item.kg * precioKg);
    const stockActual = toNumber(producto.stock_actual);

    if (stockActual < item.kg) {
      stockWarnings.push(
        `Stock bajo para ${producto.nombre}: solicitado ${item.kg} kg, disponible ${stockActual} kg.`
      );
    }

    detalles.push({
      producto_id: item.producto_id,
      kg: item.kg,
      precio_kg: precioKg,
      costo_kg: costoKg,
      subtotal
    });
  }

  const totalKg = roundMoney(detalles.reduce((sum, item) => sum + item.kg, 0));
  const totalPrecio = roundMoney(detalles.reduce((sum, item) => sum + item.subtotal, 0));

  return { detalles, totalKg, totalPrecio, stockWarnings };
};

const validateDetailsForConfirmation = async (
  detalles: PedidoDetalle[]
): Promise<void> => {
  if (!detalles.length) {
    throw new AppError('El pedido no tiene productos para confirmar', 400);
  }

  const grouped = new Map<string, number>();

  for (const detalle of detalles) {
    grouped.set(
      detalle.producto_id,
      roundMoney((grouped.get(detalle.producto_id) ?? 0) + toNumber(detalle.kg))
    );
  }

  const productos = await getProductosByIds(Array.from(grouped.keys()));
  const productMap = new Map(productos.map((producto) => [producto.id, producto]));

  for (const [productoId, kg] of grouped) {
    const producto = productMap.get(productoId);

    if (!producto) {
      throw new AppError(`Producto no encontrado: ${productoId}`, 404);
    }

    const stockActual = toNumber(producto.stock_actual);

    if (stockActual < kg) {
      throw new AppError('Stock insuficiente para realizar este movimiento.', 400, [
        {
          producto_id: productoId,
          producto: producto.nombre,
          solicitado_kg: kg,
          disponible_kg: stockActual
        }
      ]);
    }
  }
};

const buildBusinessWarnings = async (
  totalKg: number,
  fechaEntrega?: string
): Promise<{ warnings: string[]; requiere_mayoreo: boolean }> => {
  const config = await configuracionService.getCurrent();
  const limiteRapido = toNumber(config.kg_limite_rapido);
  const diasPreparacion = Number(config.dias_preparacion_mayoreo);
  const warnings: string[] = [];
  const requiereMayoreo = totalKg > limiteRapido;

  if (requiereMayoreo) {
    warnings.push(
      `Pedido mayor a ${limiteRapido} kg. Requiere ${diasPreparacion} dias de preparacion.`
    );

    if (fechaEntrega) {
      const diasDisponibles = daysBetweenTodayAnd(fechaEntrega);

      if (diasDisponibles < diasPreparacion) {
        warnings.push(
          `La fecha de entrega ${fechaEntrega} esta demasiado cercana para mayoreo. Dias requeridos: ${diasPreparacion}.`
        );
      }
    }
  }

  return { warnings, requiere_mayoreo: requiereMayoreo };
};

export const pedidosService = {
  async findAll(): Promise<Pedido[]> {
    const { data, error } = await supabase
      .from(PEDIDOS_TABLE)
      .select('*, clientes(*), pedido_detalles(*, productos(*))')
      .order('created_at', { ascending: false });

    if (error) {
      throw new AppError('No se pudieron consultar los pedidos', 500, [error]);
    }

    return data ?? [];
  },

  async findById(id: string): Promise<Pedido> {
    const { data, error } = await supabase
      .from(PEDIDOS_TABLE)
      .select('*, clientes(*), pedido_detalles(*, productos(*))')
      .eq('id', id)
      .single();

    if (error) {
      throw new AppError('Pedido no encontrado', 404, [error]);
    }

    return data;
  },

  async createOrder(input: CreatePedidoInput) {
    const origen = input.origen ?? 'whatsapp';
    const cliente = await clientesService.findOrCreateFromOrder(input.cliente, origen);
    const calculated = await calculateOrder(input.productos, input.catalogo);
    const business = await buildBusinessWarnings(calculated.totalKg, input.fecha_entrega);

    const { data: pedido, error: pedidoError } = await supabase
      .from(PEDIDOS_TABLE)
      .insert({
        cliente_id: cliente.id,
        fecha_entrega: input.fecha_entrega,
        estado: 'pendiente',
        origen,
        notas: input.notas,
        total_kg: calculated.totalKg,
        total_precio: calculated.totalPrecio
      })
      .select('*')
      .single();

    if (pedidoError) {
      throw new AppError('No se pudo crear el pedido', 400, [pedidoError]);
    }

    const detallesPayload = calculated.detalles.map((d) => aRenglon(d, pedido.id));

    const { error: detallesError } = await supabase
      .from(DETALLES_TABLE)
      .insert(detallesPayload);

    if (detallesError) {
      await supabase.from(PEDIDOS_TABLE).delete().eq('id', pedido.id);
      throw new AppError('No se pudieron crear los detalles del pedido', 400, [
        detallesError
      ]);
    }

    const fullPedido = await this.findById(pedido.id);

    return {
      pedido: fullPedido,
      requiere_mayoreo: business.requiere_mayoreo,
      warnings: [...business.warnings, ...calculated.stockWarnings]
    };
  },

  async updateOrder(id: string, input: UpdatePedidoInput) {
    const current = await this.findById(id);

    if (current.estado === 'completado' || current.estado === 'cancelado') {
      throw new AppError('No se puede editar un pedido completado o cancelado', 400);
    }

    if (input.estado && input.productos) {
      throw new AppError(
        'Actualiza productos y estado en operaciones separadas para evitar inconsistencias de inventario',
        400
      );
    }

    const patch: Record<string, unknown> = {};

    if (input.fecha_entrega !== undefined) patch.fecha_entrega = input.fecha_entrega;
    if (input.notas !== undefined) patch.notas = input.notas;

    let warnings: string[] = [];

    if (input.productos) {
      if (current.estado !== 'pendiente') {
        throw new AppError(
          'Para este MVP solo se pueden editar productos cuando el pedido esta pendiente',
          400
        );
      }

      const calculated = await calculateOrder(input.productos);
      const business = await buildBusinessWarnings(
        calculated.totalKg,
        input.fecha_entrega ?? current.fecha_entrega ?? undefined
      );

      await supabase.from(DETALLES_TABLE).delete().eq('pedido_id', id);

      const { error: detallesError } = await supabase
        .from(DETALLES_TABLE)
        .insert(calculated.detalles.map((d) => aRenglon(d, id)));

      if (detallesError) {
        throw new AppError('No se pudieron actualizar los detalles del pedido', 400, [
          detallesError
        ]);
      }

      patch.total_kg = calculated.totalKg;
      patch.total_precio = calculated.totalPrecio;
      warnings = [...business.warnings, ...calculated.stockWarnings];
    }

    if (Object.keys(patch).length > 0) {
      const { error } = await supabase
        .from(PEDIDOS_TABLE)
        .update({
          ...patch,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        throw new AppError('No se pudo actualizar el pedido', 400, [error]);
      }
    }

    if (input.estado) {
      return this.updateOrderStatus(id, input.estado);
    }

    return {
      pedido: await this.findById(id),
      warnings
    };
  },

  async updateOrderStatus(id: string, estado: PedidoEstado) {
    const pedido = await this.findById(id);

    if (
      pedido.estado === 'cancelado' &&
      (estado === 'confirmado' || estado === 'completado')
    ) {
      throw new AppError('No se puede confirmar o completar un pedido cancelado', 400);
    }

    if (pedido.estado === 'cancelado' && estado !== 'cancelado') {
      throw new AppError('No se puede cambiar el estado de un pedido cancelado', 400);
    }

    if (pedido.estado === 'completado' && estado !== 'completado') {
      throw new AppError('No se puede cambiar el estado de un pedido completado', 400);
    }

    const detalles = (pedido.pedido_detalles ?? []) as PedidoDetalle[];
    const warnings: string[] = [];

    if (estado === 'confirmado') {
      const alreadyHasSaleMovements =
        await inventarioService.hasSaleMovementsForOrder(id);

      if (alreadyHasSaleMovements) {
        warnings.push('El pedido ya tenia movimientos de venta; no se duplico inventario.');
      } else {
        await validateDetailsForConfirmation(detalles);
        warnings.push(...(await inventarioService.createSaleMovementsForOrder(id, detalles)));
      }
    }

    const { error } = await supabase
      .from(PEDIDOS_TABLE)
      .update({
        estado,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      throw new AppError('No se pudo actualizar el estado del pedido', 400, [error]);
    }

    return {
      pedido: await this.findById(id),
      warnings
    };
  }
};
