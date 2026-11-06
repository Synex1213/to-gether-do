'use strict';
function statusExpired(status, now = Date.now()) {
  const expiry = status?.expires_at && new Date(status.expires_at).getTime();
  return Number.isFinite(expiry) && expiry <= now;
}
module.exports = { statusExpired };
