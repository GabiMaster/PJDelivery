import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './database.js';
import { calculateShippingCost, kilometersToBlocks } from './shipping.js';
import { closurePdf } from './pdf.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const publicDir = join(root, 'public');
const db = openDatabase(process.env.DB_PATH || join(root, 'data', 'pjdelivery.db'));
const port = Number(process.env.PORT || 3000);
const storeName = process.env.STORE_NAME || 'PJ Delivery';

const json = (res, status, data) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
};
const badRequest = (res, message) => json(res, 400, { error: message });
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: process.env.TZ || 'America/Argentina/Cordoba' }).format(new Date());

async function body(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks)); }
  catch { throw new Error('El cuerpo de la solicitud no es JSON válido'); }
}

function listOrders(params) {
  const where = [], values = [];
  for (const [param, column] of [['date', 'o.business_date'], ['cashierId', 'o.cashier_id'], ['courierId', 'o.courier_id']]) {
    if (params.get(param)) { where.push(`${column} = ?`); values.push(params.get(param)); }
  }
  return db.prepare(`
    SELECT o.*, ca.name cashier_name, co.name courier_name
    FROM orders o JOIN cashiers ca ON ca.id=o.cashier_id
    LEFT JOIN couriers co ON co.id=o.courier_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY o.created_at DESC, o.id DESC LIMIT 500
  `).all(...values);
}

function preview(date) {
  const totals = db.prepare(`
    SELECT COUNT(*) order_count,
      COALESCE(SUM(CASE WHEN payment_method='cash' THEN total_amount ELSE 0 END),0) cash_total,
      COALESCE(SUM(CASE WHEN payment_method='transfer' THEN total_amount ELSE 0 END),0) transfer_total,
      COALESCE(SUM(total_amount),0) grand_total,
      COALESCE(SUM(order_amount),0) house_total
    FROM orders WHERE business_date=?
  `).get(date);
  const cashiers = db.prepare(`SELECT DISTINCT c.name FROM orders o JOIN cashiers c ON c.id=o.cashier_id WHERE o.business_date=? ORDER BY c.name`).all(date).map(x => x.name);
  const couriers = db.prepare(`
    SELECT c.id, c.name, COUNT(*) orders, COALESCE(SUM(o.shipping_cost),0) total
    FROM orders o JOIN couriers c ON c.id=o.courier_id
    WHERE o.business_date=? AND o.delivery_method='delivery'
    GROUP BY c.id, c.name ORDER BY c.name
  `).all(date);
  const unassigned = db.prepare(`SELECT COUNT(*) count, COALESCE(SUM(shipping_cost),0) total FROM orders WHERE business_date=? AND delivery_method='delivery' AND courier_id IS NULL`).get(date);
  return { businessDate: date, ...totals, cashiers, couriers, unassigned };
}

function createOrder(input) {
  const required = ['description', 'orderAmount', 'paymentMethod', 'deliveryMethod', 'cashierId'];
  if (required.some(key => input[key] === undefined || input[key] === '')) throw new Error('Completá todos los datos obligatorios');
  if (!['cash', 'transfer'].includes(input.paymentMethod)) throw new Error('Método de pago inválido');
  if (!['pickup', 'delivery'].includes(input.deliveryMethod)) throw new Error('Método de entrega inválido');
  const orderAmount = Math.round(Number(input.orderAmount));
  if (!Number.isFinite(orderAmount) || orderAmount < 0) throw new Error('El monto debe ser válido');
  let address = null, phone = null, distanceBlocks = null, shippingCost = 0, courierId = null;
  if (input.deliveryMethod === 'delivery') {
    if (!String(input.address || '').trim() || !String(input.phone || '').trim()) throw new Error('Dirección y teléfono son obligatorios para un envío');
    const distance = Number(input.distance);
    if (!Number.isFinite(distance) || distance < 0) throw new Error('Ingresá una distancia válida');
    distanceBlocks = input.distanceUnit === 'km' ? kilometersToBlocks(distance) : distance;
    shippingCost = calculateShippingCost(distanceBlocks);
    address = input.address.trim(); phone = input.phone.trim();
    courierId = input.courierId ? Number(input.courierId) : null;
  }
  const date = input.businessDate || today();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Fecha comercial inválida');
  const createdAt = new Date().toISOString();
  const result = db.prepare(`INSERT INTO orders
    (description,order_amount,payment_method,delivery_method,address,phone,distance_blocks,shipping_cost,total_amount,cashier_id,courier_id,business_date,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(input.description.trim(), orderAmount, input.paymentMethod, input.deliveryMethod, address, phone, distanceBlocks, shippingCost, orderAmount + shippingCost, Number(input.cashierId), courierId, date, createdAt);
  return db.prepare(`SELECT o.*, ca.name cashier_name, co.name courier_name FROM orders o JOIN cashiers ca ON ca.id=o.cashier_id LEFT JOIN couriers co ON co.id=o.courier_id WHERE o.id=?`).get(result.lastInsertRowid);
}

async function api(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/config') return json(res, 200, { storeName, today: today() });
  if (req.method === 'GET' && url.pathname === '/api/people') return json(res, 200, {
    cashiers: db.prepare('SELECT * FROM cashiers WHERE active=1 ORDER BY name').all(),
    couriers: db.prepare('SELECT * FROM couriers WHERE active=1 ORDER BY name').all()
  });
  if (req.method === 'POST' && /^\/api\/(cashiers|couriers)$/.test(url.pathname)) {
    const input = await body(req); const name = String(input.name || '').trim();
    if (!name) return badRequest(res, 'Ingresá un nombre');
    const table = url.pathname.endsWith('cashiers') ? 'cashiers' : 'couriers';
    try { const result = db.prepare(`INSERT INTO ${table} (name) VALUES (?)`).run(name); return json(res, 201, { id: Number(result.lastInsertRowid), name }); }
    catch { return badRequest(res, 'Ese nombre ya existe'); }
  }
  if (req.method === 'GET' && url.pathname === '/api/orders') return json(res, 200, listOrders(url.searchParams));
  if (req.method === 'POST' && url.pathname === '/api/orders') return json(res, 201, createOrder(await body(req)));
  if (req.method === 'GET' && url.pathname === '/api/shipping') {
    const distance = Number(url.searchParams.get('distance'));
    const blocks = url.searchParams.get('unit') === 'km' ? kilometersToBlocks(distance) : distance;
    return json(res, 200, { blocks, cost: calculateShippingCost(blocks) });
  }
  if (req.method === 'GET' && url.pathname === '/api/closures/preview') return json(res, 200, preview(url.searchParams.get('date') || today()));
  if (req.method === 'GET' && url.pathname === '/api/closures') return json(res, 200, db.prepare('SELECT * FROM cash_closures ORDER BY business_date DESC, created_at DESC').all());
  if (req.method === 'POST' && url.pathname === '/api/closures') {
    const input = await body(req); const date = input.businessDate || today(); const data = preview(date); const createdAt = new Date().toISOString();
    const result = db.prepare(`INSERT INTO cash_closures (business_date,store_name,cash_total,transfer_total,grand_total,house_total,order_count,cashiers_json,couriers_json,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(date, storeName, data.cash_total, data.transfer_total, data.grand_total, data.house_total, data.order_count, JSON.stringify(data.cashiers), JSON.stringify(data.couriers), createdAt);
    db.prepare('UPDATE orders SET closed_on=? WHERE business_date=?').run(createdAt, date);
    return json(res, 201, { id: Number(result.lastInsertRowid), ...data, createdAt });
  }
  const pdfMatch = url.pathname.match(/^\/api\/closures\/(\d+)\/pdf$/);
  if (req.method === 'GET' && pdfMatch) {
    const closure = db.prepare('SELECT * FROM cash_closures WHERE id=?').get(pdfMatch[1]);
    if (!closure) return json(res, 404, { error: 'Cierre no encontrado' });
    const pdf = closurePdf(closure);
    res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="cierre-${closure.business_date}.pdf"`, 'Content-Length': pdf.length });
    return res.end(pdf);
  }
  return json(res, 404, { error: 'Ruta no encontrada' });
}

const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    const path = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    if (path.includes('..')) return json(res, 403, { error: 'Acceso denegado' });
    const file = await readFile(join(publicDir, path));
    res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream' }); res.end(file);
  } catch (error) {
    if (error.code === 'ENOENT') return json(res, 404, { error: 'Archivo no encontrado' });
    console.error(error); badRequest(res, error.message || 'Ocurrió un error inesperado');
  }
}).listen(port, () => console.log(`${storeName} disponible en http://localhost:${port}`));
