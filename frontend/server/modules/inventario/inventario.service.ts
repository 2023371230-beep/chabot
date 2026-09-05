import { supabase } from '../../database/supabase.client';
import { AppError } from '../../shared/errors/AppError';
import { roundMoney, toNumber } from '../../shared/utils/numbers.utils';
import { productosService } from '../productos/productos.service';
import type {
  CreateInventarioMovimientoInput,
  InventarioMovimiento
} from './inventario.types';

const MOVIMIENTOS_TABLE = 'inventario_movimientos';

const stockDeltaByTipo = (tipo: string, cantidadKg: number): number => {
  // Para el MVP, ajuste suma stock cuando la cantidad enviada es positiva.
  if (tipo === 'entrada' || tipo === 'ajuste') {
    return cantidadKg;
  }

  if (tipo === 'venta' || tipo === 'merma') {
    return -cantidadKg;
  }

  return 0;
};

export const inventarioService = {
  async findMovimientos(): Promise<InventarioMovimiento[]> {
    const { data, error } = await supabase
      .from(MOVIMIENTOS_TABLE)
      .select('*, productos(nombre, categoria)')
      .order('created_at', { ascending: false });

    if (error) {
      throw new AppError('No se pudieron consultar los movimientos', 500, [error]);
    }

    return data ?? [];
  },

  async createMovimiento(
    input: CreateInventarioMovimientoInput
  ): Promise<InventarioMovimiento> {
    const producto = await productosService.findById(input.producto_id);

    const delta = stockDeltaByTipo(input.tipo, input.cantidad_kg);
    const nuevoStock = roundMoney(toNumber(producto.stock_actual) + delta);

    if ((input.tipo === 'venta' || input.tipo === 'merma') && nuevoStock < 0) {
      throw new AppError('Stock insuficiente para realizar este movimiento.', 400);
    }

    const { data, error } = await supabase
      .from(MOVIMIENTOS_TABLE)
      .insert({
        producto_id: input.producto_id,
        tipo: input.tipo,
        cantidad_kg: input.cantidad_kg,
        motivo: input.motivo,
        usuario_id: input.usuario_id,
        pedido_id: input.pedido_id
      })
      .select('*')
      .single();

    if (error) {
      throw new AppError('No se pudo registrar el movimiento de inventario', 400, [
        error
      ]);
    }

    await productosService.update(input.producto_id, {
      stock_actual: nuevoStock
    });

    return data;
  },

  async createSaleMovementsForOrder(
    pedidoId: string,
    detalles: Array<{ producto_id: string; kg: number | string }>
  ): Promise<string[]> {
    const alreadyHasSaleMovements = await this.hasSaleMovementsForOrder(pedidoId);

    if (alreadyHasSaleMovements) {
      return ['El pedido ya tenia movimientos de venta; no se duplico inventario.'];
    }

    const grouped = new Map<string, number>();

    for (const detalle of detalles) {
      grouped.set(
        detalle.producto_id,
        roundMoney((grouped.get(detalle.producto_id) ?? 0) + toNumber(detalle.kg))
      );
    }

    const products = await Promise.all(
      Array.from(grouped.keys()).map((productoId) => productosService.findById(productoId))
    );

    for (const producto of products) {
      const requiredKg = grouped.get(producto.id) ?? 0;

      if (toNumber(producto.stock_actual) < requiredKg) {
        throw new AppError('Stock insuficiente para realizar este movimiento.', 400, [
          {
            producto_id: producto.id,
            producto: producto.nombre,
            solicitado_kg: requiredKg,
            disponible_kg: toNumber(producto.stock_actual)
          }
        ]);
      }
    }

    for (const detalle of detalles) {
      await this.createMovimiento({
        producto_id: detalle.producto_id,
        tipo: 'venta',
        cantidad_kg: toNumber(detalle.kg),
        motivo: 'Venta por pedido confirmado',
        pedido_id: pedidoId
      });
    }

    return [];
  },

  async hasSaleMovementsForOrder(pedidoId: string): Promise<boolean> {
    const { count, error } = await supabase
      .from(MOVIMIENTOS_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('pedido_id', pedidoId)
      .eq('tipo', 'venta');

    if (error) {
      throw new AppError('No se pudo validar el inventario del pedido', 500, [error]);
    }

    return (count ?? 0) > 0;
  },

  async getResumen() {
    const [productos, movimientosResult] = await Promise.all([
      productosService.findAll(),
      supabase.from(MOVIMIENTOS_TABLE).select('*')
    ]);

    if (movimientosResult.error) {
      throw new AppError('No se pudo calcular el resumen de inventario', 500, [
        movimientosResult.error
      ]);
    }

    const resumenPorProducto = new Map<
      string,
      {
        total_entradas: number;
        total_ventas: number;
        total_mermas: number;
        total_ajustes: number;
      }
    >();

    for (const movimiento of movimientosResult.data ?? []) {
      const current = resumenPorProducto.get(movimiento.producto_id) ?? {
        total_entradas: 0,
        total_ventas: 0,
        total_mermas: 0,
        total_ajustes: 0
      };

      const cantidad = toNumber(movimiento.cantidad_kg);

      if (movimiento.tipo === 'entrada') current.total_entradas += cantidad;
      if (movimiento.tipo === 'venta') current.total_ventas += cantidad;
      if (movimiento.tipo === 'merma') current.total_mermas += cantidad;
      if (movimiento.tipo === 'ajuste') current.total_ajustes += cantidad;

      resumenPorProducto.set(movimiento.producto_id, current);
    }

    return productos.map((producto) => ({
      producto_id: producto.id,
      nombre: producto.nombre,
      categoria: producto.categoria,
      precio_kg: toNumber(producto.precio_kg),
      stock_actual: toNumber(producto.stock_actual),
      stock_minimo: toNumber(producto.stock_minimo),
      ...(resumenPorProducto.get(producto.id) ?? {
        total_entradas: 0,
        total_ventas: 0,
        total_mermas: 0,
        total_ajustes: 0
      })
    }));
  }
};
