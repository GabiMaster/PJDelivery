import test from 'node:test';
import assert from 'node:assert/strict';
import {closurePdf} from '../src/pdf.js';

test('genera el cierre con tres tablas, identidad visual y saldo negativo destacado', () => {
  const pdf = closurePdf({
    store_name: 'PJ Delivery',
    business_date: '2026-09-03',
    created_at: '2026-09-03T22:00:00Z',
    cashiers_json: '["Gabriel"]',
    couriers_json: '[{"name":"Ariel","orders":2,"toRender":5000,"earnings":7000,"netToCash":-2000}]',
    order_count: 4,
    transfer_total: 12000,
    grand_total: 30000,
    cash: {
      grossCash: 18000,
      cashBeforeReplenishment: 11000,
      physicalCashAfterReplenishment: 9500,
      permanentExpenses: 1000,
      customerChange: 500,
      replenishmentNeeded: 1500
    },
    movements: [
      {type: 'permanente', amount: 1000},
      {type: 'vuelto_cliente', amount: 500}
    ],
    changeFundBalance: 98500
  });
  const content = pdf.toString('binary');

  assert.match(content, /Resumen general/);
  assert.match(content, /Rendicion por delivery/);
  assert.match(content, /Retiros del vuelto en caja/);
  assert.match(content, /TOTAL NETO DEL DIA/);
  assert.match(content, /\(\$ 21\.500\) Tj/);
  assert.doesNotMatch(content, /\(\$ 30\.000\) Tj/);
  assert.match(content, /0\.72 0\.05 0\.08 rg/);
  assert.match(content, /-\$ 2\.000/);
});
