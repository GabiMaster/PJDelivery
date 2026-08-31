import test from 'node:test';
import assert from 'node:assert/strict';
import { assessConfidence, computeRoute, geocodeAddress } from '../src/maps.js';

const response = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data });

test('convierte distanceMeters a cuadras', async () => {
  const result = await computeRoute({latitude:-27.4,longitude:-58.9},{latitude:-27.5,longitude:-59},{apiKey:'test',fetchImpl:async()=>response({routes:[{distanceMeters:5130}]})});
  assert.deepEqual(result, { distanceMeters: 5130, blocks: 51.3 });
});

test('marca coincidencias parciales y aproximadas como baja confianza', () => {
  const result = assessConfidence({ partial_match:true, types:['route'], geometry:{location_type:'APPROXIMATE'} });
  assert.equal(result.lowConfidence, true);
  assert.equal(result.reasons.length, 3);
});

test('agrega el contexto local y acepta una dirección precisa', async () => {
  let requested;
  const result = await geocodeAddress('French 450',{apiKey:'test',context:'Resistencia, Chaco, Argentina',fetchImpl:async url=>{requested=url;return response({status:'OK',results:[{formatted_address:'French 450, Resistencia',types:['street_address'],geometry:{location:{lat:-27.4,lng:-58.9},location_type:'ROOFTOP'}}]})}});
  assert.match(requested.searchParams.get('address'), /Resistencia, Chaco, Argentina/);
  assert.equal(result.lowConfidence, false);
});

test('reporta cuota agotada explícitamente', async () => {
  await assert.rejects(()=>geocodeAddress('French 450',{apiKey:'test',fetchImpl:async()=>response({status:'OVER_QUERY_LIMIT'})}),error=>error.code==='quota_exceeded');
});
