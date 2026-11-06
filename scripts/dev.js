'use strict';
// Honor the host/port arguments used by development preview runners.
const args = process.argv.slice(2);
const port = args.indexOf('--port'), host = args.indexOf('--host');
if (port !== -1) {
  const value = Number(args[port + 1]);
  if (!Number.isInteger(value) || value < 1 || value > 65535) throw new Error('Invalid development port');
  process.env.PORT = String(value);
}
if (host !== -1 && args[host + 1]) process.env.HOST = args[host + 1];
require('../src/server');
