import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublicMenuCache, servePublicMenu } from '../src/public-menu.js';

test('la carta pública funciona sin token y solo proyecta campos permitidos',async()=>{
  const getMenu=createPublicMenuCache(async()=>[
    {name:'Pizza',price:1000,type:'food',category:'Pizzas',ingredients:'Queso',active:true,orders:[{phone:'secreto'}],cashiers:['privado']},
    {name:'Oculto',price:1,type:'food',category:'Otros',active:false}
  ]);
  const output={status:null,headers:null,body:null,writeHead(status,headers){this.status=status;this.headers=headers},end(body){this.body=body}};
  await servePublicMenu(output,getMenu,'Local');
  assert.equal(output.status,200);assert.match(output.headers['Cache-Control'],/max-age=300/);assert.match(output.body,/Pizza/);assert.match(output.body,/Queso/);assert.doesNotMatch(output.body,/Oculto|secreto|privado|cashiers|orders/);
});

test('el caché evita repetir lecturas durante cinco minutos',async()=>{
  let reads=0;const getMenu=createPublicMenuCache(async()=>{reads++;return[{name:'Pizza',price:1,active:true}]});
  await getMenu();await getMenu();assert.equal(reads,1);
});
