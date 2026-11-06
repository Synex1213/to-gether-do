'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_API_BASE, normalizeConfig } = require('../desktop/config');
const smallWindowDefaults = { snapToEdge: true, positionLocked: false, onboardingSeen: false, statusDurationMinutes: 0, recentActivities: [] };

test('fresh and malformed configs use the verified live service', () => {
  assert.equal(DEFAULT_API_BASE, 'https://to-gether-do-2.onrender.com');
  for (const saved of [undefined, null, [], 'invalid', {}, { apiBase: '  ' }]) {
    assert.deepEqual(normalizeConfig(saved), { apiBase: DEFAULT_API_BASE, autoLaunch: false, alwaysOnTop: true, theme: 'green', compact: true, ...smallWindowDefaults });
  }
});
test('migrates suspended service addresses and preserves desktop preferences', () => {
  for (const apiBase of ['https://to-gether-do.onrender.com', ' https://to-gether-do.onrender.com/ ', 'https://to-gether-do-1.onrender.com/']) {
    assert.deepEqual(normalizeConfig({ apiBase, alwaysOnTop: false, autoLaunch: true }), { apiBase: DEFAULT_API_BASE, alwaysOnTop: false, autoLaunch: true, theme: 'green', compact: true, ...smallWindowDefaults });
  }
});

test('window preferences and recent activities survive restart and reject malformed values', () => {
  const cfg = normalizeConfig({ positionLocked: true, snapToEdge: false, onboardingSeen: true, statusDurationMinutes: 60, recentActivities:['study','study','invalid','work','eat','sleep'] });
  assert.equal(cfg.positionLocked,true); assert.equal(cfg.snapToEdge,false); assert.equal(cfg.onboardingSeen,true); assert.equal(cfg.statusDurationMinutes,60);
  assert.deepEqual(cfg.recentActivities,['study','work','eat']);
  const invalid = normalizeConfig({positionLocked:'true', statusDurationMinutes:'60', recentActivities:'study'});
  assert.equal(invalid.positionLocked,false); assert.equal(invalid.statusDurationMinutes,0); assert.deepEqual(invalid.recentActivities,[]);
});
test('preserves custom and local deployments', () => {
  for (const apiBase of ['https://custom.example.com', 'http://localhost:3000', 'https://custom.example.com/path', 'https://to-gether-do.onrender.com/custom']) {
    assert.equal(normalizeConfig({ apiBase }).apiBase, apiBase);
  }
});

test('themes and compact preference survive restart and invalid themes fall back to the original green', () => {
  for (const theme of ['blue','purple','green','yellow','pink','black','white']) {
    const config = normalizeConfig({ theme, compact: false });
    assert.equal(config.theme, theme); assert.equal(config.compact, false);
  }
  assert.equal(normalizeConfig({theme:'invalid'}).theme,'green');
});
