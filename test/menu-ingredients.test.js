import test from 'node:test';
import assert from 'node:assert/strict';
import { ingredientsFor } from '../src/menu-ingredients.js';

test('comparte ingredientes entre tamaños de pizza',()=>{
  assert.equal(ingredientsFor('Pizza Calabresa - Media'),ingredientsFor('Pizza Calabresa - Completa'));
  assert.match(ingredientsFor('Pizza Calabresa - Media'),/longaniza/);
});

test('adapta el pan en las variantes de lomo',()=>{
  assert.match(ingredientsFor('Lomo Simple - Completo'),/^Pan meguete/);
  assert.match(ingredientsFor('Lomo Simple - Pan de Hamburguesa'),/^Pan de hamburguesa/);
});
