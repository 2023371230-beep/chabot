export type ConfiguracionEmpresa = {
  id: string;
  kg_limite_rapido: number | string;
  dias_preparacion_mayoreo: number;
  horario_apertura: string;
  horario_cierre: string;
  mensaje_fuera_horario: string | null;
  created_at: string;
  updated_at: string;
};

export type UpdateConfiguracionInput = {
  kg_limite_rapido?: number;
  dias_preparacion_mayoreo?: number;
  horario_apertura?: string;
  horario_cierre?: string;
  mensaje_fuera_horario?: string;
};
