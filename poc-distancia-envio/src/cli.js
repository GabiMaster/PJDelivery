import { baseConfig, resolveOrigin } from './config.js';
import { calculateDistance } from './maps.js';

const addresses = process.argv.slice(2);
if (!addresses.length) {
  console.error('Uso: npm run cli -- "Dirección 1" "Dirección 2"');
  process.exitCode = 1;
} else {
  const config = baseConfig();
  config.origin = await resolveOrigin(config);
  const rows = [];
  for (const address of addresses) {
    const result = await calculateDistance(address, config);
    rows.push({ dirección: address, estado: result.status, encontrada: result.geocode?.formattedAddress || '-', metros: result.route?.distanceMeters ?? '-', cuadras: result.route?.blocks ?? '-', 'estimación manual': '' });
  }
  console.table(rows);
}
