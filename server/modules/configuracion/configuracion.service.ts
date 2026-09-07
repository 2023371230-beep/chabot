import { supabase } from '../../database/supabase.client';
import { AppError } from '../../shared/errors/AppError';
import type {
  ConfiguracionEmpresa,
  UpdateConfiguracionInput
} from './configuracion.types';

const TABLE = 'configuracion_empresa';

/**
 * Cache de la configuracion.
 *
 * Es UNA fila que cambia una vez al mes y se consulta varias veces por
 * mensaje de WhatsApp: `buildBusinessWarnings` la lee para el limite de
 * mayoreo y, en el mismo pedido, `avisoFueraDeHorario` la lee otra vez. A 30-80
 * ms por viaje desde Vercel, son dos viajes de red por pedido para el mismo
 * dato inmovil.
 *
 * Un minuto de vida es suficiente: si alguien cambia el horario en Reglas, el
 * bot lo aplica en menos de lo que tarda en llegar el siguiente mensaje. Y
 * `update` la invalida al instante, asi que quien acaba de guardar ve su
 * cambio de inmediato.
 */
const VIDA_CACHE_MS = 60_000;
let cache: { valor: ConfiguracionEmpresa; expira: number } | null = null;

export const configuracionService = {
  async getCurrent(): Promise<ConfiguracionEmpresa> {
    if (cache && Date.now() < cache.expira) return cache.valor;

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
      cache = { valor: data, expira: Date.now() + VIDA_CACHE_MS };
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

    cache = { valor: created, expira: Date.now() + VIDA_CACHE_MS };
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

    // Se refresca en vez de solo invalidar: quien acaba de guardar vuelve a
    // leer en la misma pantalla y debe ver su propio cambio.
    cache = { valor: data, expira: Date.now() + VIDA_CACHE_MS };
    return data;
  }
};
