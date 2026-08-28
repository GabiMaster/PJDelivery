import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateShippingCost, kilometersToBlocks } from '../src/shipping.js';

test('caso obligatorio: 5,1 km, pedido de $28.000', () => {
  const blocks = kilometersToBlocks(5.1);
  const shipping = calculateShippingCost(blocks);
  assert.equal(blocks, 51);
  assert.equal(shipping, 7320);
  assert.equal(28000 + shipping, 35320);
});

test('casos borde y distancia grande', () => {
  assert.equal(calculateShippingCost(0), 1800);
  assert.equal(calculateShippingCost(5), 1800);
  assert.equal(calculateShippingCost(10), 1800);
  assert.equal(calculateShippingCost(11), 3600);
  assert.equal(calculateShippingCost(20), 3600);
  assert.equal(calculateShippingCost(100), 13200);
});

test('rechaza distancias inválidas', () => {
  assert.throws(() => calculateShippingCost(-1), /mayor o igual a cero/);
  assert.throws(() => kilometersToBlocks('texto'), /mayor o igual a cero/);
});
