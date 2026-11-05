'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
process.env.PORT = '0';
process.env.HOST = '127.0.0.1';
process.env.NODE_ENV = 'test';
delete process.env.DATABASE_URL;
const serverReady = require('../src/server');

test('pair lifecycle, stale invitations, isolation and concurrent joins', async () => {
  const server = await serverReady;
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function request(path, token, method = 'GET', body) {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, data: await response.json() };
  }
  async function register(name) {
    const r = await request('/auth/register', null, 'POST', { username: name, password: 'testing-123', displayName: name });
    assert.equal(r.status, 200); return r.data.token;
  }
  try {
    const a = await register('alice'), b = await register('bob'), c = await register('carol'), d = await register('dave');
    const aCode = (await request('/pair/code', a, 'POST')).data;
    const bCode = (await request('/pair/code', b, 'POST')).data;
    assert.equal(aCode.status, 'waiting');
    assert.equal((await request('/pair/join', b, 'POST', { code: aCode.code })).status, 200);
    assert.equal((await request('/pair/join', c, 'POST', { code: bCode.code })).status, 404);
    const oldTask = (await request('/tasks', a, 'POST', { content: '旧关系的任务' })).data.task;
    assert.ok(oldTask.id);
    assert.equal((await request('/reviews', b, 'PUT', { taskId: oldTask.id, emoji: 'cheer', comment: '加油' })).status, 200);
    await request('/status', a, 'PUT', { customActivity: '复习第三章', activity: 'study' });
    assert.equal((await request('/status', b)).data.theirs.custom_activity, '复习第三章');
    assert.equal((await request('/pair', a, 'DELETE')).status, 200);
    assert.equal((await request('/pair', b)).data.status, 'none');
    assert.equal((await request('/tasks', b)).status, 400);
    const freshCode = (await request('/pair/code', a, 'POST')).data.code;
    assert.notEqual(freshCode, aCode.code);
    const joins = await Promise.all([request('/pair/join', c, 'POST', { code: freshCode }), request('/pair/join', d, 'POST', { code: freshCode })]);
    assert.equal(joins.filter(r => r.status === 200).length, 1);
    const newPartner = joins[0].status === 200 ? c : d;
    assert.equal((await request('/tasks', newPartner)).data.tasks.length, 0);
    assert.equal((await request('/status', newPartner)).data.theirs.custom_activity, null);
    assert.equal((await request('/reviews', newPartner, 'PUT', { taskId: oldTask.id, emoji: 'cheer' })).status, 403);
    const current = (await request('/pair', a)).data;
    assert.ok(current.pairId);
    assert.equal((await request('/pair/code', a, 'POST')).status, 400);
    const preflight = await fetch(base + '/status', { method: 'OPTIONS', headers: { Origin: 'null', 'Access-Control-Request-Headers': 'authorization,content-type' } });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), 'null');
  } finally { await new Promise(resolve => server.close(resolve)); }
});
