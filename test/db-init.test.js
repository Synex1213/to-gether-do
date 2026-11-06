'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const dbPath = path.join(__dirname, '..', 'src', 'db.js');
const source = fs.readFileSync(dbPath, 'utf8');

// 每个场景独立加载数据库模块，不修改测试进程的环境或 require 缓存。
function loadDb(env, loadDependency) {
  const sandbox = {
    module: { exports: {} },
    process: { env },
    require: loadDependency,
  };
  vm.runInNewContext(source, sandbox, { filename: dbPath });
  return sandbox.module.exports;
}

for (const databaseUrl of [undefined, '', '  \n  ']) {
  test(`production rejects missing/blank DATABASE_URL: ${JSON.stringify(databaseUrl)}`, async () => {
    const dependencies = [];
    const db = loadDb({ NODE_ENV: 'production', DATABASE_URL: databaseUrl }, (id) => {
      dependencies.push(id);
      throw new Error(`Unexpected dependency: ${id}`);
    });
    await assert.rejects(db.initDb(), /NODE_ENV=production.*DATABASE_URL/);
    assert.deepEqual(dependencies, []);
  });
}

for (const pgssl of [undefined, 'false', 'true']) {
  test(`production selects pg without loading pg-mem; PGSSL=${pgssl}`, async () => {
    const dependencies = [];
    let options;
    const schema = [];
    const db = loadDb({
      NODE_ENV: 'production',
      DATABASE_URL: '  postgresql://user:password@localhost/app  ',
      PGSSL: pgssl,
    }, (id) => {
      dependencies.push(id);
      assert.equal(id, 'pg');
      return { Pool: class {
        constructor(config) { options = config; }
        async query(sql) { schema.push(sql); return { rows: [] }; }
      } };
    });
    await db.initDb();
    assert.deepEqual(dependencies, ['pg']);
    assert.equal(db.isMemory, false);
    assert.equal(options.connectionString, 'postgresql://user:password@localhost/app');
    assert.equal(Boolean(options.ssl), pgssl === 'true');
    if (pgssl === 'true') assert.equal(options.ssl.rejectUnauthorized, false);
    assert.ok(schema.some(sql => sql.includes('CREATE TABLE IF NOT EXISTS users')));
  });
}

test('missing local pg-mem reports the install command and keeps the original cause', async () => {
  const missing = Object.assign(new Error("Cannot find module 'pg-mem'"), { code: 'MODULE_NOT_FOUND' });
  const db = loadDb({ NODE_ENV: 'development' }, (id) => {
    assert.equal(id, 'pg-mem');
    throw missing;
  });
  await assert.rejects(db.initDb(), (err) => {
    assert.match(err.message, /npm install --include=dev/);
    assert.equal(err.cause, missing);
    return true;
  });
});

test('errors in a dependency of pg-mem are not mislabeled as missing pg-mem', async () => {
  const missing = Object.assign(new Error("Cannot find module 'pgsql-ast-parser'"), { code: 'MODULE_NOT_FOUND' });
  const db = loadDb({}, () => { throw missing; });
  await assert.rejects(db.initDb(), (err) => err === missing);
});

test('other pg-mem loading failures preserve the original error', async () => {
  const original = new Error('adapter initialization failed');
  const db = loadDb({}, () => { throw original; });
  await assert.rejects(db.initDb(), (err) => err === original);
});

test('local preview initializes the real pg-mem schema and can save/read a user', async () => {
  const db = loadDb({ NODE_ENV: 'development' }, (id) => {
    assert.equal(id, 'pg-mem');
    return require(id);
  });
  await db.initDb();
  assert.equal(db.isMemory, true);
  await db.query(
    'INSERT INTO users (id, username, display_name, password_hash) VALUES ($1, $2, $3, $4)',
    ['test-user', 'test_user', 'Test user', 'test-hash']
  );
  const user = await db.one('SELECT username FROM users WHERE id = $1', ['test-user']);
  assert.equal(user.username, 'test_user');
});

test('upgrades an existing status table without losing data and can run the migration twice', async () => {
  // pg-mem flags unused CREATE definitions when IF NOT EXISTS skips a table.
  // Disable that emulator-only AST coverage check; data/column assertions remain.
  const mem = require('pg-mem').newDb({noAstCoverageCheck:true});
  mem.public.none(`CREATE TABLE statuses (
    user_id text PRIMARY KEY, mood text NOT NULL DEFAULT 'normal', focus text NOT NULL DEFAULT 'available',
    activity text NOT NULL DEFAULT 'idle', custom_activity text, last_active_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
  ); INSERT INTO statuses (user_id,custom_activity) VALUES ('existing','保留旧状态')`);
  const db = loadDb({}, id => { assert.equal(id,'pg-mem'); return {newDb:()=>mem}; });
  await db.initDb();await db.initDb();
  const row = await db.one('SELECT custom_activity, expires_at FROM statuses WHERE user_id = $1',['existing']);
  assert.equal(row.custom_activity,'保留旧状态');assert.equal(row.expires_at,null);
});
