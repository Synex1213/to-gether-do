'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_API_BASE, normalizeConfig } = require('../desktop/config');

test('fresh and malformed configs use the verified live service', () => {
  assert.equal(DEFAULT_API_BASE, 'https://to-gether-do-2.onrender.com');
  for (const saved of [undefined, null, [], 'invalid', {}, { apiBase: '  ' }]) {
    assert.deepEqual(normalizeConfig(saved), { apiBase: DEFAULT_API_BASE, autoLaunch: false, alwaysOnTop: true });
  }
});
test('migrates suspended service addresses and preserves desktop preferences', () => {
  for (const apiBase of ['https://to-gether-do.onrender.com', ' https://to-gether-do.onrender.com/ ', 'https://to-gether-do-1.onrender.com/']) {
    assert.deepEqual(normalizeConfig({ apiBase, alwaysOnTop: false, autoLaunch: true }), { apiBase: DEFAULT_API_BASE, alwaysOnTop: false, autoLaunch: true });
  }
});
test('preserves custom and local deployments', () => {
  for (const apiBase of ['https://custom.example.com', 'http://localhost:3000', 'https://custom.example.com/path', 'https://to-gether-do.onrender.com/custom']) {
    assert.equal(normalizeConfig({ apiBase }).apiBase, apiBase);
  }
});
