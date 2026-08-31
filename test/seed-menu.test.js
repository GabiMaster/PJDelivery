import test from 'node:test';
import assert from 'node:assert/strict';
import { documentIdFor, validateMenuItems } from '../scripts/seed-menu.js';

test('valida y normaliza comidas al esquema interno', () => {
  const [item] = validateMenuItems([{ name: ' Pizza ', price: 1000, type: 'comida', category: 'Pizzas', active: true }]);
  assert.deepEqual(item, { name: 'Pizza', price: 1000, type: 'food', category: 'Pizzas', ingredients: null, active: true });
});
test('genera IDs determinísticos y detecta nombres duplicados', () => {
  assert.equal(documentIdFor('Pizza Muzzarella'), documentIdFor(' pizza muzzarella '));
  assert.throws(() => validateMenuItems([{ name:'Pizza',price:1,type:'comida',category:'Pizzas' },{ name:' pizza ',price:2,type:'comida',category:'Pizzas' }]), /duplicado/);
});
