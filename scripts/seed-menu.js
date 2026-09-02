import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { firestore } from '../src/firebase.js';
import { ingredientsFor } from '../src/menu-ingredients.js';

const defaultFile = resolve(fileURLToPath(new URL('../../carta-seed.json', import.meta.url)));
export const normalizeName = name => String(name).trim().normalize('NFKC').toLocaleLowerCase('es-AR');
export const documentIdFor = name => `menu_${createHash('sha256').update(normalizeName(name)).digest('hex').slice(0, 24)}`;

export function validateMenuItems(value) {
  if (!Array.isArray(value) || value.length === 0) throw new Error('El archivo debe contener un array no vacío');
  const names = new Set();
  return value.map((raw, index) => {
    const name = String(raw.name || '').trim(), category = String(raw.category || '').trim();
    const price = Number(raw.price), type = raw.type === 'comida' ? 'food' : raw.type;
    if (!name) throw new Error(`Ítem ${index + 1}: falta name`);
    if (!Number.isInteger(price) || price < 0) throw new Error(`Ítem "${name}": price debe ser un entero no negativo`);
    if (!['food', 'promo'].includes(type)) throw new Error(`Ítem "${name}": type debe ser comida o promo`);
    if (!category) throw new Error(`Ítem "${name}": falta category`);
    const key = normalizeName(name);
    if (names.has(key)) throw new Error(`Nombre duplicado en el archivo: "${name}"`);
    names.add(key);
    return { name, price, type, category, description: raw.description || raw.ingredients || ingredientsFor(name), active: raw.active !== false };
  });
}

export async function seedMenu(filePath, { dryRun = false } = {}) {
  const items = validateMenuItems(JSON.parse(await readFile(filePath, 'utf8')));
  const promos = items.filter(item => item.type === 'promo').length, foods = items.length - promos;
  if (dryRun) return { total: items.length, promos, foods, created: 0, updated: 0, dryRun: true };
  const collection = firestore.collection('menuItems');
  const current = await collection.get();
  const byName = new Map(current.docs.map(doc => [normalizeName(doc.data().name), doc]));
  const batch = firestore.batch(), now = new Date().toISOString();
  let created = 0, updated = 0;
  for (const item of items) {
    const existing = byName.get(normalizeName(item.name));
    batch.set(existing?.ref || collection.doc(documentIdFor(item.name)), { ...item, updatedAt: now, ...(existing ? {} : { createdAt: now }) }, { merge: true });
    existing ? updated++ : created++;
  }
  await batch.commit();
  return { total: items.length, promos, foods, created, updated, dryRun: false };
}

async function main() {
  const args = process.argv.slice(2), dryRun = args.includes('--dry-run');
  const filePath = resolve(args.find(arg => !arg.startsWith('--')) || process.env.SEED_MENU_FILE || defaultFile);
  const result = await seedMenu(filePath, { dryRun });
  console.log(`${dryRun ? 'Validación' : 'Carga'} completada: ${result.total} ítems (${result.promos} promos + ${result.foods} comidas).`);
  if (!dryRun) console.log(`Creados: ${result.created}. Actualizados: ${result.updated}.`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch(error => { console.error(`No se pudo cargar la carta: ${error.message}`); process.exitCode = 1; });
