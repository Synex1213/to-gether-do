'use strict';
const CONNECTION_CODES = new Set(['ENOTFOUND','ECONNREFUSED','ECONNRESET','ETIMEDOUT','EPIPE','57P01','57P02','57P03','08001','08003','08006','53300','3D000']);
const isConnectionError = error => CONNECTION_CODES.has(error?.code) || /connection.*(terminated|timeout|closed)|timeout.*connection/i.test(error?.message || '');
function createReadiness({ initialize, probe, log = console.error, schedule = setTimeout, cancel = clearTimeout }) {
  let ready = false, stopped = false, timer, checking = false;
  function queue(delay) { cancel(timer); if (!stopped) { timer = schedule(check, delay); timer?.unref?.(); } }
  async function check() {
    if (checking || stopped) return;
    checking = true;
    try { if (ready) await probe(); else await initialize(); ready = true; }
    catch (error) { if (ready || !timer) log('同步数据库暂不可用，将自动重试', { code: CONNECTION_CODES.has(error?.code) ? error.code : 'DATABASE_UNAVAILABLE' }); ready = false; }
    finally { checking = false; queue(ready ? 15000 : 30000); }
  }
  return {
    get ready() { return ready; },
    start: check,
    unavailable(error) { ready = false; if (!checking) queue(30000); },
    stop() { stopped = true; cancel(timer); },
  };
}
module.exports = { createReadiness, isConnectionError };
