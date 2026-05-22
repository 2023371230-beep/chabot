import { supabase } from '../../database/supabase.client';
import { AppError } from '../../shared/errors/AppError';
import type {
  CreateProductoInput,
  Producto,
  UpdateProductoInput
} from './productos.types';

const TABLE = 'productos';

const handleSupabaseError = (message: string, error: unknown): never => {
  throw new AppError(message, 500, [error]);
};

export const productosService = {
  async findAll(): Promise<Producto[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('nombre', { ascending: true });

    if (error) {
      handleSupabaseError('No se pudieron consultar los productos', error);
    }

    return data ?? [];
  },

  async findById(id: string): Promise<Producto> {
    const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).single();

    if (error) {
      throw new AppError('Producto no encontrado', 404, [error]);
    }

    return data;
  },

  async create(input: CreateProductoInput): Promise<Producto> {
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        nombre: input.nombre,
        categoria: input.categoria ?? 'pollo',
        precio_kg: input.precio_kg,
        stock_actual: input.stock_actual ?? 0,
        stock_minimo: input.stock_minimo ?? 0
      })
      .select('*')
      .single();

    if (error) {
      handleSupabaseError('No se pudo crear el producto', error);
    }

    return data;
  },

  async update(id: string, input: UpdateProductoInput): Promise<Producto> {
    const { data, error } = await supabase
      .from(TABLE)
      .update({
        ...input,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new AppError('No se pudo actualizar el producto', 400, [error]);
    }

    return data;
  },

  async setActive(id: string, activo: boolean): Promise<Producto> {
    return this.update(id, { activo });
  }
};
