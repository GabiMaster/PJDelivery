import { geocodeAddress, MapsError } from './maps.js';

export function baseConfig() {
  const travelMode = process.env.TRAVEL_MODE || 'DRIVE';
  if (!['DRIVE', 'TWO_WHEELER'].includes(travelMode)) throw new MapsError('configuration', 'TRAVEL_MODE debe ser DRIVE o TWO_WHEELER');
  return { apiKey: process.env.GOOGLE_MAPS_API_KEY, context: process.env.ADDRESS_CONTEXT || 'Resistencia, Chaco, Argentina', travelMode, allowLowConfidence: process.env.ALLOW_LOW_CONFIDENCE === 'true' };
}

let originPromise;
export function resolveOrigin(config) {
  if (!originPromise) originPromise = (async () => {
    const latitude = Number(process.env.STORE_LAT), longitude = Number(process.env.STORE_LNG);
    if (process.env.STORE_LAT && process.env.STORE_LNG && Number.isFinite(latitude) && Number.isFinite(longitude)) return { latitude, longitude };
    if (!process.env.STORE_ORIGIN) throw new MapsError('configuration', 'Configurá STORE_LAT/STORE_LNG o STORE_ORIGIN');
    const value = await geocodeAddress(process.env.STORE_ORIGIN, config);
    if (value.lowConfidence) throw new MapsError('configuration', `El origen del local tiene baja confianza: ${value.reasons.join('; ')}`);
    return { latitude: value.latitude, longitude: value.longitude };
  })();
  return originPromise;
}
