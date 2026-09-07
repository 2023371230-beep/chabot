export const toDateOnly = (date = new Date()): string => {
  return date.toISOString().slice(0, 10);
};

export const addDays = (date: Date, days: number): Date => {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
};

export const parseDateOnly = (value: string): Date => {
  return new Date(`${value}T00:00:00.000Z`);
};

export const daysBetweenTodayAnd = (dateOnly: string): number => {
  const today = parseDateOnly(toDateOnly());
  const target = parseDateOnly(dateOnly);
  const diff = target.getTime() - today.getTime();

  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};
