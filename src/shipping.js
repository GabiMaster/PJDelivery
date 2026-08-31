export const BASE_RATE = 1700;
export const EXTRA_BLOCK_RATE = 120;

export function kilometersToBlocks(kilometers) {
  const value = Number(kilometers);
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError('La distancia debe ser un número mayor o igual a cero');
  }
  return Math.round((value * 10 + Number.EPSILON) * 100) / 100;
}

export function calculateShippingCost(blocks) {
  const distance = Number(blocks);
  if (!Number.isFinite(distance) || distance < 0) {
    throw new TypeError('La distancia debe ser un número mayor o igual a cero');
  }
  if (distance <= 10) return BASE_RATE;

  const remaining = distance - 10;
  return Math.round(BASE_RATE + remaining * EXTRA_BLOCK_RATE);
}
