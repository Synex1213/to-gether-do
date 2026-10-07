'use strict';

// 数据库访问层：
// - 配置了 DATABASE_URL（Render）：连接真实 PostgreSQL，数据持久化
// - 未配置（本地开发）：使用 pg-mem 内存库，重启即清空，仅用于本地预览/演示
// 上层只面对同一套 query 接口与标准 SQL。

let pool;
const isMemory = !(process.env.DATABASE_URL || '').trim();

async function initPool() {
  const databaseUrl = (process.env.DATABASE_URL || '').trim();

  if (databaseUrl) {
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: databaseUrl,
      // Render 同区域 Internal URL 可直接连接；PGSSL=true 可显式启用 TLS。
      ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
    });
    return;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'NODE_ENV=production 时必须设置 DATABASE_URL。' +
      '请先创建 PostgreSQL，再在 Render Web Service 的 Environment 中填写 Internal Database URL，保存并重新部署。'
    );
  }

  let newDb;
  try {
    ({ newDb } = require('pg-mem'));
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND' && err.message.includes("Cannot find module 'pg-mem'")) {
      throw new Error(
        '本地内存模式需要 pg-mem。请先 npm install --include=dev，再运行 npm start；生产部署请设置 DATABASE_URL。',
        { cause: err }
      );
    }
    throw err;
  }

  const mem = newDb();
  const { Pool } = mem.adapters.createPg();
  pool = new Pool();
}

async function query(text, params) {
  const res = await pool.query(text, params || []);
  return res.rows;
}

async function one(text, params) {
  const rows = await query(text, params);
  return rows[0] || null;
}

const SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS users (
     id text PRIMARY KEY,
     username text UNIQUE NOT NULL,
     display_name text NOT NULL,
     password_hash text NOT NULL,
     created_at timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS pairs (
     id text PRIMARY KEY,
     user_a text NOT NULL,
     user_b text,
     pair_code text UNIQUE NOT NULL,
     status text NOT NULL DEFAULT 'pending',
     created_at timestamptz NOT NULL DEFAULT now(),
     paired_at timestamptz
   )`,
  `CREATE TABLE IF NOT EXISTS tasks (
     id text PRIMARY KEY,
     owner_id text NOT NULL,
     pair_id text,
     task_date date NOT NULL,
     content text NOT NULL,
     is_completed boolean NOT NULL DEFAULT false,
     completed_at timestamptz,
     sort_order integer NOT NULL DEFAULT 0,
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS statuses (
     user_id text PRIMARY KEY,
     mood text NOT NULL DEFAULT 'normal',
     focus text NOT NULL DEFAULT 'available',
     activity text NOT NULL DEFAULT 'idle',
     custom_activity text,
     last_active_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS reviews (
     id text PRIMARY KEY,
     task_id text NOT NULL,
     reviewer_id text NOT NULL,
     emoji text,
     comment text,
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now(),
     UNIQUE (task_id, reviewer_id)
   )`,
  `CREATE TABLE IF NOT EXISTS slacking_catches (
     id text PRIMARY KEY,
     caught_id text NOT NULL,
     catcher_id text NOT NULL,
     pair_id text,
     note text,
     created_at timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_owner_date ON tasks (owner_id, task_date)`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_pair_date ON tasks (pair_id, task_date)`,
  `CREATE INDEX IF NOT EXISTS idx_catches_caught ON slacking_catches (caught_id)`,
  `CREATE INDEX IF NOT EXISTS idx_catches_pair ON slacking_catches (pair_id)`,
];

async function initDb() {
  await initPool();
  for (const sql of SCHEMA_SQL) {
    await query(sql);
  }
}

module.exports = { initDb, query, one, isMemory };
