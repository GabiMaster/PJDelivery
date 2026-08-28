import test from 'node:test';
import assert from 'node:assert/strict';
import { orderScope, requireAdmin, requireCashier } from '../src/access.js';

test('un cajero solo puede consultar su propia caja', () => {
  assert.equal(orderScope({ uid: 'c1', role: 'cashier' }), 'c1');
  assert.throws(() => orderScope({ uid: 'c1', role: 'cashier' }, 'c2'), error => error.status === 403);
});

test('un administrador puede consultar cualquier cajero pero no operar caja', () => {
  assert.equal(orderScope({ uid: 'admin', role: 'admin' }, 'c2'), 'c2');
  assert.doesNotThrow(() => requireAdmin({ role: 'admin' }));
  assert.throws(() => requireCashier({ role: 'admin' }), error => error.status === 403);
});
