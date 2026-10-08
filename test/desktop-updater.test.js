'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createAutoUpdateController, CHECK_INTERVAL_MS } = require('../desktop/updater');

function harness({ packed = true, platform = 'win32', response = 1 } = {}) {
  const updater = new EventEmitter();
  const app = { isPackaged: packed, isQuitting: false };
  const messages = [];
  const logger = { info() {}, error() {} };
  let checks = 0;
  let installs = 0;
  let tick;
  let stopped = false;
  updater.checkForUpdates = async () => { checks++; };
  updater.quitAndInstall = () => { installs++; };
  const dialog = { showMessageBox: async (opts) => { messages.push(opts); return { response }; } };
  const controller = createAutoUpdateController({
    app, dialog, autoUpdater: updater, logger, platform,
    scheduleInterval(fn, delay) {
      assert.equal(delay, CHECK_INTERVAL_MS);
      tick = fn;
      return { unref() {} };
    },
    clearScheduledInterval() { stopped = true; },
  });
  return {
    updater, app, messages, controller,
    tick: () => tick?.(),
    get checks() { return checks; },
    get installs() { return installs; },
    get stopped() { return stopped; },
  };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

test('never checks for updates while unpackaged', async () => {
  const h = harness({ packed: false });
  await flush();
  assert.equal(h.checks, 0);
  assert.equal(await h.controller.checkForUpdates(true), false);
});

test('never checks for updates on non-Windows platforms', async () => {
  const h = harness({ platform: 'linux' });
  await flush();
  assert.equal(h.checks, 0);
});

test('checks on startup, periodically, and turns on automatic downloads', async () => {
  const h = harness();
  await flush();
  assert.equal(h.checks, 1);
  assert.equal(h.updater.autoDownload, true);
  assert.equal(h.updater.autoInstallOnAppQuit, false);
  assert.equal(h.updater.allowPrerelease, false);
  h.tick();
  await flush();
  assert.equal(h.checks, 2);
  h.controller.stop();
  assert.equal(h.stopped, true);
});

test('asks before restart and actually allows tray window to close', async () => {
  const h = harness({ response: 0 });
  await flush();
  h.updater.emit('update-downloaded', { version: '1.0.1' });
  await flush();
  assert.equal(h.messages.length, 1);
  assert.match(h.messages[0].detail, /1\.0\.1/);
  assert.equal(h.app.isQuitting, true);
  assert.equal(h.installs, 1);
});

test('declining restart keeps the app running and manual check can ask again', async () => {
  const h = harness();
  await flush();
  h.updater.emit('update-downloaded', { version: '1.0.1' });
  await flush();
  assert.equal(h.installs, 0);
  assert.equal(h.app.isQuitting, false);
  await h.controller.checkForUpdates(true);
  assert.equal(h.messages.length, 2);
});

test('a manual check shows an up-to-date message', async () => {
  const h = harness();
  await flush();
  h.updater.checkForUpdates = async () => { h.updater.emit('update-not-available'); };
  assert.equal(await h.controller.checkForUpdates(true), true);
  assert.match(h.messages[0].message, /最新版本/);
});

test('failed checks are contained and a manual check explains failure', async () => {
  const h = harness();
  await flush();
  h.updater.checkForUpdates = async () => { throw new Error('offline'); };
  assert.equal(await h.controller.checkForUpdates(true), false);
  assert.match(h.messages[0].title, /失败/);
});
