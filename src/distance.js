import { calculateShippingCost } from './shipping.js';
import { computeRoute, geocodeAddress, MapsError } from './maps.js';

export function mapsConfig(env = process.env) {
  const latitude = Number(env.STORE_LAT), longitude = Number(env.STORE_LNG);
  const travelMode = env.TRAVEL_MODE || 'DRIVE';
  if (!env.GOOGLE_MAPS_API_KEY || !Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new MapsError('configuration', 'Faltan GOOGLE_MAPS_API_KEY, STORE_LAT o STORE_LNG');
  if (!['DRIVE', 'TWO_WHEELER'].includes(travelMode)) throw new MapsError('configuration', 'TRAVEL_MODE debe ser DRIVE o TWO_WHEELER');
  return { apiKey:env.GOOGLE_MAPS_API_KEY,context:env.ADDRESS_CONTEXT||'Resistencia, Chaco, Argentina',travelMode,origin:{latitude,longitude} };
}

export async function calculateShippingQuote(address, { config = mapsConfig(), fetchImpl = fetch } = {}) {
  try {
    const geocode = await geocodeAddress(address, { ...config, fetchImpl });
    console.log(JSON.stringify({event:'shipping_geocode',input:geocode.input,coordinates:{latitude:geocode.latitude,longitude:geocode.longitude},confidence:geocode.confidence,reasons:geocode.reasons}));
    if (geocode.confidence === 'low') return { confidence:'low',formattedAddress:geocode.formattedAddress,reasons:geocode.reasons,distanceMeters:null,distanceBlocks:null,shippingCost:null };
    const route = await computeRoute(config.origin, geocode, { ...config, fetchImpl });
    return { confidence:'high',formattedAddress:geocode.formattedAddress,reasons:[],...route,shippingCost:calculateShippingCost(route.distanceBlocks) };
  } catch (error) {
    const known = error instanceof MapsError ? error : new MapsError('unexpected', error.message);
    console.error(JSON.stringify({event:'shipping_distance_error',input:address,code:known.code,message:known.message}));
    return { confidence:'error',error:{code:known.code,message:known.message},distanceMeters:null,distanceBlocks:null,shippingCost:null };
  }
}
