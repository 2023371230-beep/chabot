export const toNumber = (value: unknown): number => {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    return Number(value);
  }

  return 0;
};

export const roundMoney = (value: number): number => {
  return Math.round((value + Number.EPSILON) * 100) / 100;
};
