import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { baseConfig, resolveOrigin } from './config.js';
import { calculateDistance } from './maps.js';

const htmlPath = fileURLToPath(new URL('../public/index.html', import.meta.url));
const port = Number(process.env.PORT || 3100);
const json = (res, status, value) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); };

createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(await readFile(htmlPath)); }
    if (req.method === 'POST' && req.url === '/api/calculate') {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const input = JSON.parse(Buffer.concat(chunks));
      if (!Array.isArray(input.addresses) || input.addresses.length > 20) return json(res, 400, { error: 'Enviá entre 1 y 20 direcciones' });
      const config = baseConfig(); config.origin = await resolveOrigin(config);
      const results = [];
      for (const address of input.addresses) results.push(await calculateDistance(address, config));
      return json(res, 200, { results });
    }
    json(res, 404, { error: 'Ruta no encontrada' });
  } catch (error) { console.error(error); json(res, 500, { error: error.message || 'Error inesperado' }); }
}).listen(port, () => console.log(`POC de distancia disponible en http://localhost:${port}`));
