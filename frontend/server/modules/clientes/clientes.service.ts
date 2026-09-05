import { supabase } from '../../database/supabase.client';
import { AppError } from '../../shared/errors/AppError';
import type { Cliente, CreateClienteInput, UpdateClienteInput } from './clientes.types';

const TABLE = 'clientes';

export const clientesService = {
  async findAll(): Promise<Cliente[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new AppError('No se pudieron consultar los clientes', 500, [error]);
    }

    return data ?? [];
  },

  async findById(id: string): Promise<Cliente> {
    const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).single();

    if (error) {
      throw new AppError('Cliente no encontrado', 404, [error]);
    }

    return data;
  },

  async findByPhone(telefono: string): Promise<Cliente | null> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('telefono', telefono)
      .maybeSingle();

    if (error) {
      throw new AppError('No se pudo consultar el cliente por telefono', 500, [error]);
    }

    return data;
  },

  async create(input: CreateClienteInput): Promise<Cliente> {
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        nombre: input.nombre,
        telefono: input.telefono,
        direccion: input.direccion,
        notas: input.notas
      })
      .select('*')
      .single();

    if (error) {
      throw new AppError('No se pudo crear el cliente', 400, [error]);
    }

    return data;
  },

  async update(id: string, input: UpdateClienteInput): Promise<Cliente> {
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
      throw new AppError('No se pudo actualizar el cliente', 400, [error]);
    }

    if (!data) {
      throw new AppError('Cliente no encontrado', 404);
    }

    return data;
  },

  async findOrCreateFromOrder(
    input: CreateClienteInput & { id?: string },
    origen: 'whatsapp' | 'dashboard' | 'manual' = 'whatsapp'
  ): Promise<Cliente> {
    if (input.id) {
      return this.findById(input.id);
    }

    const existing = await this.findByPhone(input.telefono);

    if (!existing) {
      if (!input.nombre?.trim() && origen !== 'whatsapp') {
        throw new AppError('Nombre de cliente requerido para pedidos del dashboard', 400);
      }

      return this.create({
        ...input,
        nombre: input.nombre?.trim() || 'Cliente WhatsApp'
      });
    }

    const patch: UpdateClienteInput = {};

    if (input.nombre) patch.nombre = input.nombre;
    if (input.direccion) patch.direccion = input.direccion;
    if (input.notas) patch.notas = input.notas;

    if (Object.keys(patch).length === 0) {
      return existing;
    }

    return this.update(existing.id, patch);
  }
};
