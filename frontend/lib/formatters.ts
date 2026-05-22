export const formatCurrency = (value: number | string | null | undefined) => {
  const number = Number(value ?? 0);
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(number);
};

export const formatKg = (value: number | string | null | undefined) => {
  return `${Number(value ?? 0).toLocaleString('es-MX', {
    maximumFractionDigits: 2
  })} kg`;
};

export const formatDate = (value?: string | null) => {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium'
  }).format(new Date(`${value}`));
};

export const formatDateTime = (value?: string | null) => {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
};
