export const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
});

export function formatMoney(value) {
  return BRL.format(Number(value || 0));
}

export function toNumber(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}