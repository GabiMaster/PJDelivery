import test from 'node:test';import assert from 'node:assert/strict';
import {cashSummary,changeFundBalanceAfter,courierSettlements} from '../src/accounting.js';

const orders=[
  {deliveryMethod:'delivery',courierId:'d1',courierName:'Ana',paymentMethod:'cash',orderAmount:10000,shippingCost:2000,totalAmount:12000},
  {deliveryMethod:'delivery',courierId:'d1',courierName:'Ana',paymentMethod:'transfer',orderAmount:8000,shippingCost:1800,totalAmount:9800},
  {deliveryMethod:'pickup',paymentMethod:'cash',orderAmount:5000,shippingCost:0,totalAmount:5000}
];
test('calcula lo rendido, la ganancia y el monto neto positivo que queda en caja',()=>{assert.deepEqual(courierSettlements(orders),[{id:'d1',name:'Ana',orders:2,toRender:12000,earnings:3800,netToCash:8200}])});
test('indica con un neto negativo cuánto debe pagarle la caja al delivery',()=>{const [value]=courierSettlements([{deliveryMethod:'delivery',courierId:'d1',courierName:'Ana',paymentMethod:'transfer',orderAmount:8000,shippingCost:1800,totalAmount:9800}]);assert.equal(value.toRender,0);assert.equal(value.earnings,1800);assert.equal(value.netToCash,-1800)});
test('relaciona el efectivo antes del reintegro, el neto y el físico final',()=>{const value=cashSummary(orders,[{type:'permanente',amount:1000},{type:'vuelto_cliente',amount:700}]);assert.equal(value.grossCash,17000);assert.equal(value.pickupCash,5000);assert.equal(value.courierNetCash,8200);assert.equal(value.cashBeforeReplenishment,13200);assert.equal(value.netCash,12200);assert.equal(value.physicalCashAfterReplenishment,11500);assert.equal(value.cashBeforeReplenishment-value.permanentExpenses,value.netCash);assert.equal(value.cashBeforeReplenishment-value.permanentExpenses-value.customerChange,value.physicalCashAfterReplenishment);assert.equal(value.replenishmentNeeded,1700)});
test('el saldo persistente baja con egresos y sube por el monto exacto reintegrado',()=>{let stored=100000;stored=changeFundBalanceAfter(stored,'permanente',5000);assert.equal(stored,95000);assert.equal(stored,95000);stored=changeFundBalanceAfter(stored,'reintegro',3725);assert.equal(stored,98725)});
