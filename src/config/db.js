import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..', '..');

// DATABASE_URL points at the SQLite file. Kept as a single env var so that
// switching to Postgres/MySQL later only touches this module + the query layer.
const dbPath = process.env.DATABASE_URL
  ? path.resolve(projectRoot, process.env.DATABASE_URL)
  : path.join(projectRoot, 'data', 'qgroup.db');

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Create the schema if it does not exist yet. Idempotent — safe to call on
 * every boot and from the migrate script.
 */
export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      login         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL CHECK (role IN ('admin','manager','sales','partner')),
      is_active     INTEGER NOT NULL DEFAULT 1,
      display_name  TEXT,
      phone         TEXT,
      color         TEXT,
      department    TEXT,
      led_access    INTEGER NOT NULL DEFAULT 0,
      company       TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      created_by    INTEGER REFERENCES users(id),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      code          TEXT NOT NULL UNIQUE,
      name          TEXT NOT NULL,
      name_ro       TEXT,
      category      TEXT,
      description   TEXT,
      description_ro TEXT,
      price_retail  REAL,
      price_partner REAL,
      image_path    TEXT,
      thumb_path    TEXT,
      is_active     INTEGER NOT NULL DEFAULT 1,
      is_new        INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      created_by    INTEGER REFERENCES users(id),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_by    INTEGER REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    CREATE INDEX IF NOT EXISTS idx_products_active   ON products(is_active);
    CREATE INDEX IF NOT EXISTS idx_products_code      ON products(code);

    CREATE TABLE IF NOT EXISTS product_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id  INTEGER,
      action      TEXT NOT NULL,
      changed_by  INTEGER REFERENCES users(id),
      details     TEXT,
      changed_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER,
      action      TEXT NOT NULL,
      changed_by  INTEGER REFERENCES users(id),
      details     TEXT,
      changed_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Commercial proposals (КП). One table for all variants (general/led/partner).
    CREATE TABLE IF NOT EXISTS kps (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      variant       TEXT NOT NULL,
      num           TEXT NOT NULL,
      type          TEXT,
      lang          TEXT,
      client_name   TEXT,
      company       TEXT,
      phone         TEXT,
      email         TEXT,
      address       TEXT,
      object_type   TEXT,
      region        TEXT,
      manager       TEXT,
      total_orig    TEXT,
      total         TEXT,
      discount      TEXT,
      status        TEXT,
      kp_date       TEXT,
      json          TEXT,
      creator_email TEXT,
      creator_role  TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(variant, num)
    );
    CREATE INDEX IF NOT EXISTS idx_kps_variant ON kps(variant);
    CREATE INDEX IF NOT EXISTS idx_kps_creator ON kps(creator_email);

    CREATE TABLE IF NOT EXISTS login_logs (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id  INTEGER,
      login    TEXT,
      role     TEXT,
      at       TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS kp_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      variant     TEXT,
      num         TEXT,
      action      TEXT NOT NULL,
      actor       TEXT,
      actor_role  TEXT,
      client_name TEXT,
      total       TEXT,
      device      TEXT,
      detail      TEXT,
      at          TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_kp_logs_at ON kp_logs(at);

    CREATE TABLE IF NOT EXISTS contacts (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT NOT NULL,
      position     TEXT,
      position_ro  TEXT,
      department   TEXT,
      phone        TEXT,
      email        TEXT,
      photo_path   TEXT,
      thumb_path   TEXT,
      sort_order   INTEGER NOT NULL DEFAULT 0,
      is_active    INTEGER NOT NULL DEFAULT 1,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_contacts_order ON contacts(sort_order, name);
  `);

  // Bring older databases up to date.
  migrateUsersTable();
  ensureColumns('products', {
    name_ro: 'TEXT',
    description_ro: 'TEXT',
    is_new: 'INTEGER NOT NULL DEFAULT 0',
  });
  ensureColumns('users', {
    display_name: 'TEXT',
    phone: 'TEXT',
    color: 'TEXT',
    department: 'TEXT',
    led_access: 'INTEGER NOT NULL DEFAULT 0',
    company: 'TEXT',
  });
}

/**
 * The original users table allowed only admin/manager/partner. Adding the
 * 'sales' role means relaxing the CHECK constraint, which SQLite can only do
 * by rebuilding the table. Runs once on databases created before the change.
 */
function migrateUsersTable() {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get();
  if (!row || row.sql.includes("'sales'")) return; // already up to date

  db.pragma('foreign_keys = OFF');
  db.transaction(() => {
    db.exec(`
      CREATE TABLE users_new (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        login         TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role          TEXT NOT NULL CHECK (role IN ('admin','manager','sales','partner')),
        is_active     INTEGER NOT NULL DEFAULT 1,
        display_name  TEXT, phone TEXT, color TEXT, department TEXT,
        led_access    INTEGER NOT NULL DEFAULT 0, company TEXT,
        created_at    TEXT NOT NULL DEFAULT (datetime('now')),
        created_by    INTEGER,
        updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    db.exec(`
      INSERT INTO users_new (id, login, password_hash, role, is_active, created_at, created_by, updated_at)
      SELECT id, login, password_hash, role, is_active, created_at, created_by, updated_at FROM users;
    `);
    db.exec('DROP TABLE users');
    db.exec('ALTER TABLE users_new RENAME TO users');
  })();
  db.pragma('foreign_keys = ON');
}

/** Idempotently add missing columns to an existing table. */
function ensureColumns(table, columns) {
  const existing = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  for (const [name, type] of Object.entries(columns)) {
    if (!existing.includes(name)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
    }
  }
}

export default db;
