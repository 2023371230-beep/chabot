import { supabase } from '../../database/supabase.client';
import { AppError } from '../../shared/errors/AppError';
import type {
  ConfiguracionEmpresa,
  UpdateConfiguracionInput
} from './configuracion.types';

const TABLE = 'configuracion_empresa';

export const configuracionService = {
  async getCurrent(): Promise<ConfiguracionEmpresa> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new AppError('No se pudo consultar la configuracion', 500, [error]);
    }

    if (data) {
      return data;
    }

    const { data: created, error: createError } = await supabase
      .from(TABLE)
      .insert({})
      .select('*')
      .single();

    if (createError) {
      throw new AppError('No se pudo crear la configuracion inicial', 500, [createError]);
    }

    return created;
  },

  async update(
    id: string,
    input: UpdateConfiguracionInput
  ): Promise<ConfiguracionEmpresa> {
    const { data, error } = await supabase
      .from(TABLE)
      .update({
        ...input,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new AppError('No se pudo actualizar la configuracion', 400, [error]);
    }

    if (!data) {
      throw new AppError('Configuracion no encontrada', 404);
    }

    return data;
  }
};
