import test from 'node:test';import assert from 'node:assert/strict';
import {isActiveOrder,isBoardOrder,missingForTransition,validateStatusTransition} from '../src/order-workflow.js';

test('bloquea preparación e informa todos los campos faltantes',()=>{const order={status:'recibido',items:[]};assert.deepEqual(missingForTransition(order,'en_preparacion'),['nombre del cliente','ítems del pedido','forma de entrega','método de pago']);assert.throws(()=>validateStatusTransition(order,'en_preparacion'),/nombre del cliente.*ítems.*forma.*método/)});
test('un envío necesita delivery para quedar listo, un retiro no',()=>{assert.throws(()=>validateStatusTransition({status:'en_preparacion',deliveryMethod:'delivery'},'listo'),/delivery asignado/);assert.doesNotThrow(()=>validateStatusTransition({status:'en_preparacion',deliveryMethod:'pickup'},'listo'))});
test('entregados y cancelados salen del tablero activo',()=>{assert.equal(isActiveOrder({status:'entregado'}),false);assert.equal(isActiveOrder({status:'cancelado'}),false);assert.equal(isActiveOrder({status:'recibido'}),true)});
test('un pedido de una jornada anterior puede avanzar desde el historial',()=>{assert.doesNotThrow(()=>validateStatusTransition({status:'recibido',businessDate:'2026-08-20',customerName:'Cliente',items:[{name:'Pizza'}],deliveryMethod:'pickup',paymentMethod:'cash'},'en_preparacion'))});
test('el tablero diario incluye entregados pero no cancelados',()=>{assert.equal(isBoardOrder({status:'entregado'}),true);assert.equal(isBoardOrder({status:'cancelado'}),false)});
