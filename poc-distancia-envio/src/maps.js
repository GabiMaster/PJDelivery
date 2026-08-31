const GEOCODING_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const PRECISE_TYPES = new Set(['street_address', 'premise', 'subpremise', 'intersection']);
const PRECISE_LOCATION_TYPES = new Set(['ROOFTOP', 'RANGE_INTERPOLATED']);

export class MapsError extends Error {
  constructor(code, message, details) { super(message); this.name = 'MapsError'; this.code = code; this.details = details; }
}

async function parseResponse(response, service) {
  let data;
  try { data = await response.json(); } catch { throw new MapsError('invalid_response', `${service} devolvió una respuesta inválida`); }
  if (response.status === 429) throw new MapsError('quota_exceeded', `${service}: cuota agotada`, data);
  if (!response.ok) throw new MapsError('api_error', `${service}: ${data.error?.message || `HTTP ${response.status}`}`, data);
  return data;
}

export function assessConfidence(result) {
  const reasons = [];
  if (result.partial_match) reasons.push('Google devolvió una coincidencia parcial');
  if (!result.types?.some(type => PRECISE_TYPES.has(type))) reasons.push(`tipo poco específico: ${(result.types || []).join(', ') || 'sin tipo'}`);
  const locationType = result.geometry?.location_type;
  if (!PRECISE_LOCATION_TYPES.has(locationType)) reasons.push(`ubicación aproximada: ${locationType || 'desconocida'}`);
  return { lowConfidence: reasons.length > 0, reasons };
}

export async function geocodeAddress(address, { apiKey, context = 'Resistencia, Chaco, Argentina', fetchImpl = fetch } = {}) {
  const input = String(address || '').trim();
  if (!input) throw new MapsError('invalid_input', 'Ingresá una dirección');
  if (!apiKey) throw new MapsError('configuration', 'Falta GOOGLE_MAPS_API_KEY');
  const query = `${input}, ${context}`;
  const url = new URL(GEOCODING_URL);
  url.searchParams.set('address', query);
  url.searchParams.set('components', 'country:AR');
  url.searchParams.set('language', 'es');
  url.searchParams.set('region', 'ar');
  url.searchParams.set('key', apiKey);
  let response;
  try { response = await fetchImpl(url, { signal: AbortSignal.timeout(10000) }); }
  catch (error) { throw new MapsError('network_error', `No se pudo contactar Geocoding API: ${error.message}`); }
  const data = await parseResponse(response, 'Geocoding API');
  if (data.status === 'OVER_QUERY_LIMIT') throw new MapsError('quota_exceeded', 'Geocoding API: cuota agotada');
  if (data.status !== 'OK' || !data.results?.length) {
    const code = data.status === 'ZERO_RESULTS' ? 'not_found' : 'api_error';
    throw new MapsError(code, code === 'not_found' ? 'Dirección no encontrada' : `Geocoding API: ${data.error_message || data.status}`);
  }
  const result = data.results[0], confidence = assessConfidence(result), location = result.geometry.location;
  return { input, query, formattedAddress: result.formatted_address, latitude: location.lat, longitude: location.lng, types: result.types || [], locationType: result.geometry.location_type, ...confidence };
}

export async function computeRoute(origin, destination, { apiKey, travelMode = 'DRIVE', fetchImpl = fetch } = {}) {
  if (!apiKey) throw new MapsError('configuration', 'Falta GOOGLE_MAPS_API_KEY');
  let response;
  try {
    response = await fetchImpl(ROUTES_URL, {
      method: 'POST', signal: AbortSignal.timeout(10000),
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': 'routes.distanceMeters' },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: origin.latitude, longitude: origin.longitude } } },
        destination: { location: { latLng: { latitude: destination.latitude, longitude: destination.longitude } } },
        travelMode, computeAlternativeRoutes: false, languageCode: 'es-AR', units: 'METRIC'
      })
    });
  } catch (error) { throw new MapsError('network_error', `No se pudo contactar Routes API: ${error.message}`); }
  const data = await parseResponse(response, 'Routes API');
  const distanceMeters = data.routes?.[0]?.distanceMeters;
  if (!Number.isFinite(distanceMeters)) throw new MapsError('route_not_found', 'Routes API no encontró una ruta transitable', data);
  return { distanceMeters, blocks: Math.round((distanceMeters / 100) * 100) / 100 };
}

export async function calculateDistance(address, config) {
  try {
    const destination = await geocodeAddress(address, config);
    console.log(JSON.stringify({ event: 'geocode', input: destination.input, coordinates: { latitude: destination.latitude, longitude: destination.longitude }, lowConfidence: destination.lowConfidence, reasons: destination.reasons }));
    if (destination.lowConfidence && !config.allowLowConfidence) return { status: 'low_confidence', geocode: destination, route: null };
    const route = await computeRoute(config.origin, destination, config);
    return { status: destination.lowConfidence ? 'low_confidence_routed' : 'ok', geocode: destination, route };
  } catch (error) {
    const known = error instanceof MapsError ? error : new MapsError('unexpected', error.message);
    console.error(JSON.stringify({ event: 'distance_error', input: address, code: known.code, message: known.message }));
    return { status: 'error', error: { code: known.code, message: known.message } };
  }
}
