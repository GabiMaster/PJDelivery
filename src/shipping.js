export const BASE_RATE = 1800;
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
  const sectionPrice = remaining <= 10
    ? BASE_RATE
    : BASE_RATE + (remaining - 10) * EXTRA_BLOCK_RATE;
  return Math.round(sectionPrice + BASE_RATE);
}
