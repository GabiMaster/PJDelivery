import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateShippingCost, kilometersToBlocks } from '../src/shipping.js';

test('51 cuadras: base de $1.700 más 41 cuadras a $120', () => {
  const blocks = kilometersToBlocks(5.1);
  const shipping = calculateShippingCost(blocks);
  assert.equal(blocks, 51);
  assert.equal(shipping, 6620);
  assert.equal(28000 + shipping, 34620);
});

test('casos borde y distancia grande', () => {
  assert.equal(calculateShippingCost(0), 1700);
  assert.equal(calculateShippingCost(5), 1700);
  assert.equal(calculateShippingCost(10), 1700);
  assert.equal(calculateShippingCost(11), 1820);
  assert.equal(calculateShippingCost(20), 2900);
  assert.equal(calculateShippingCost(100), 12500);
});

test('rechaza distancias inválidas', () => {
  assert.throws(() => calculateShippingCost(-1), /mayor o igual a cero/);
  assert.throws(() => kilometersToBlocks('texto'), /mayor o igual a cero/);
});
