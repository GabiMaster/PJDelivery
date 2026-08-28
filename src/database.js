import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function openDatabase(path) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS cashiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS couriers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      order_amount INTEGER NOT NULL CHECK(order_amount >= 0),
      payment_method TEXT NOT NULL CHECK(payment_method IN ('cash', 'transfer')),
      delivery_method TEXT NOT NULL CHECK(delivery_method IN ('pickup', 'delivery')),
      address TEXT,
      phone TEXT,
      distance_blocks REAL,
      shipping_cost INTEGER NOT NULL DEFAULT 0 CHECK(shipping_cost >= 0),
      total_amount INTEGER NOT NULL CHECK(total_amount >= 0),
      cashier_id INTEGER NOT NULL REFERENCES cashiers(id),
      courier_id INTEGER REFERENCES couriers(id),
      business_date TEXT NOT NULL,
      closed_on TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_orders_business_date ON orders(business_date);
    CREATE INDEX IF NOT EXISTS idx_orders_cashier ON orders(cashier_id);
    CREATE INDEX IF NOT EXISTS idx_orders_courier ON orders(courier_id);
    CREATE TABLE IF NOT EXISTS cash_closures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_date TEXT NOT NULL,
      store_name TEXT NOT NULL,
      cash_total INTEGER NOT NULL,
      transfer_total INTEGER NOT NULL,
      grand_total INTEGER NOT NULL,
      house_total INTEGER NOT NULL,
      order_count INTEGER NOT NULL,
      cashiers_json TEXT NOT NULL,
      couriers_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_closures_date ON cash_closures(business_date);
  `);
  seed(db, 'cashiers', 'Cajero principal');
  seed(db, 'couriers', 'Delivery 1');
  return db;
}

function seed(db, table, name) {
  const count = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;
  if (!count) db.prepare(`INSERT INTO ${table} (name) VALUES (?)`).run(name);
}
