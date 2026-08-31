const GEOCODING_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const PRECISE_TYPES = new Set(['street_address', 'premise', 'subpremise', 'intersection']);
const PRECISE_LOCATIONS = new Set(['ROOFTOP', 'RANGE_INTERPOLATED']);

export class MapsError extends Error {
  constructor(code, message) { super(message); this.name = 'MapsError'; this.code = code; }
}

async function parseResponse(response, service) {
  let data;
  try { data = await response.json(); } catch { throw new MapsError('invalid_response', `${service} devolvió una respuesta inválida`); }
  if (response.status === 429) throw new MapsError('quota_exceeded', `${service}: cuota agotada`);
  if (!response.ok) throw new MapsError('api_error', `${service}: ${data.error?.message || `HTTP ${response.status}`}`);
  return data;
}

export function assessConfidence(result) {
  const reasons = [];
  if (result.partial_match) reasons.push('coincidencia parcial');
  if (!result.types?.some(type => PRECISE_TYPES.has(type))) reasons.push('tipo de dirección poco específico');
  if (!PRECISE_LOCATIONS.has(result.geometry?.location_type)) reasons.push('ubicación aproximada');
  return { confidence: reasons.length ? 'low' : 'high', reasons };
}

export async function geocodeAddress(address, { apiKey, context, fetchImpl = fetch }) {
  const input = String(address || '').trim();
  if (!input) throw new MapsError('invalid_input', 'Ingresá una dirección');
  if (!apiKey) throw new MapsError('configuration', 'El cálculo automático no está configurado');
  const url = new URL(GEOCODING_URL);
  url.searchParams.set('address', `${input}, ${context}`);
  url.searchParams.set('components', 'country:AR');
  url.searchParams.set('language', 'es'); url.searchParams.set('region', 'ar'); url.searchParams.set('key', apiKey);
  let response;
  try { response = await fetchImpl(url, { signal: AbortSignal.timeout(10000) }); }
  catch { throw new MapsError('network_error', 'No se pudo contactar Geocoding API'); }
  const data = await parseResponse(response, 'Geocoding API');
  if (data.status === 'OVER_QUERY_LIMIT') throw new MapsError('quota_exceeded', 'Geocoding API: cuota agotada');
  if (data.status !== 'OK' || !data.results?.length) throw new MapsError(data.status === 'ZERO_RESULTS' ? 'not_found' : 'api_error', data.status === 'ZERO_RESULTS' ? 'Dirección no encontrada' : `Geocoding API: ${data.error_message || data.status}`);
  const result = data.results[0], location = result.geometry.location;
  return { input, formattedAddress: result.formatted_address, latitude: location.lat, longitude: location.lng, ...assessConfidence(result) };
}

export async function computeRoute(origin, destination, { apiKey, travelMode, fetchImpl = fetch }) {
  let response;
  try { response = await fetchImpl(ROUTES_URL, { method:'POST', signal:AbortSignal.timeout(10000), headers:{'Content-Type':'application/json','X-Goog-Api-Key':apiKey,'X-Goog-FieldMask':'routes.distanceMeters'}, body:JSON.stringify({origin:{location:{latLng:{latitude:origin.latitude,longitude:origin.longitude}}},destination:{location:{latLng:{latitude:destination.latitude,longitude:destination.longitude}}},travelMode,computeAlternativeRoutes:false,languageCode:'es-AR',units:'METRIC'}) }); }
  catch { throw new MapsError('network_error', 'No se pudo contactar Routes API'); }
  const data = await parseResponse(response, 'Routes API'), distanceMeters = data.routes?.[0]?.distanceMeters;
  if (!Number.isFinite(distanceMeters)) throw new MapsError('route_not_found', 'No se encontró una ruta transitable');
  return { distanceMeters, distanceBlocks: Math.round(distanceMeters) / 100 };
}
