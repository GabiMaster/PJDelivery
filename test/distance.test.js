import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateShippingQuote } from '../src/distance.js';

const response = (data, status=200) => ({ok:status>=200&&status<300,status,json:async()=>data});
const config={apiKey:'test',context:'Resistencia, Chaco, Argentina',travelMode:'DRIVE',origin:{latitude:-27.45,longitude:-58.98}};

test('el endpoint lógico devuelve distancia, cuadras y tarifa con confianza alta',async()=>{
  let calls=0;
  const fetchImpl=async()=>++calls===1?response({status:'OK',results:[{formatted_address:'French 450, Resistencia',types:['street_address'],geometry:{location:{lat:-27.46,lng:-58.99},location_type:'ROOFTOP'}}]}):response({routes:[{distanceMeters:5100}]});
  const result=await calculateShippingQuote('French 450',{config,fetchImpl});
  assert.deepEqual(result,{confidence:'high',formattedAddress:'French 450, Resistencia',reasons:[],distanceMeters:5100,distanceBlocks:51,shippingCost:6620});
});

test('la baja confianza no consulta Routes API',async()=>{
  let calls=0;
  const result=await calculateShippingQuote('Dirección dudosa',{config,fetchImpl:async()=>{calls++;return response({status:'OK',results:[{formatted_address:'Resistencia',partial_match:true,types:['locality'],geometry:{location:{lat:-27.4,lng:-58.9},location_type:'APPROXIMATE'}}]})}});
  assert.equal(result.confidence,'low');assert.equal(result.shippingCost,null);assert.equal(calls,1);
});

test('un error de red se devuelve como confianza error',async()=>{
  const result=await calculateShippingQuote('French 450',{config,fetchImpl:async()=>{throw new Error('offline')}});
  assert.equal(result.confidence,'error');assert.equal(result.error.code,'network_error');
});
