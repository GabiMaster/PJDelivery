import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateItemsTotal, snapshotItems } from '../src/order.js';

test('calcula el monto a partir de precio por cantidad', () => {
  const items = [{ menuItemId: 'pizza', name: 'Pizza', unitPrice: 9000, quantity: 2 }, { name: 'Extra', unitPrice: 1500, quantity: 1 }];
  assert.equal(calculateItemsTotal(items), 19500);
  assert.deepEqual(snapshotItems(items).map(x => x.subtotal), [18000, 1500]);
  assert.equal(snapshotItems(items)[1].isCustom, true);
});

test('rechaza pedidos sin ítems o cantidades inválidas', () => {
  assert.throws(() => calculateItemsTotal([]), /al menos un ítem/);
  assert.throws(() => calculateItemsTotal([{ name: 'Pizza', unitPrice: 1, quantity: 0 }]), /cantidad/);
});
