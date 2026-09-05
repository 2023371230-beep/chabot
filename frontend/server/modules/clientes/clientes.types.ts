export type Cliente = {
  id: string;
  nombre: string | null;
  telefono: string;
  direccion: string | null;
  notas: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type CreateClienteInput = {
  nombre?: string;
  telefono: string;
  direccion?: string;
  notas?: string;
};

export type UpdateClienteInput = {
  nombre?: string;
  telefono?: string;
  direccion?: string;
  notas?: string;
};
