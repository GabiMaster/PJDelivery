import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateItemsTotal, resolveDeliveryDistance, snapshotItems } from '../src/order.js';
import { kilometersToBlocks } from '../src/shipping.js';

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

test('una corrección manual prevalece sobre la distancia automática anterior', () => {
  const result = resolveDeliveryDistance({ distance: 4.2, distanceUnit: 'km', distanceSource: 'manual', distanceConfidence: 'high', autoDistanceBlocks: 51 }, kilometersToBlocks);
  assert.deepEqual(result, { distanceBlocks: 42, distanceSource: 'manual', distanceConfidence: null });
});
