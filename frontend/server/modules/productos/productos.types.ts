export type Producto = {
  id: string;
  nombre: string;
  categoria: string | null;
  precio_kg: number | string;
  stock_actual: number | string;
  stock_minimo: number | string;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type CreateProductoInput = {
  nombre: string;
  categoria?: string;
  precio_kg: number;
  stock_actual?: number;
  stock_minimo?: number;
};

export type UpdateProductoInput = Partial<CreateProductoInput> & {
  activo?: boolean;
};
