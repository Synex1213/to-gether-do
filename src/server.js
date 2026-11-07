'use strict';

const express = require('express');
const path = require('path');
const { initDb, isMemory, query } = require('./db');
const { createReadiness, isConnectionError } = require('./readiness');
const { createReleaseResolver } = require('./releases');
const latestRelease = createReleaseResolver();

const app = express();
const initialize = async () => {
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) throw Object.assign(new Error('Authentication is not configured'), {code:'CONFIGURATION_UNAVAILABLE'});
  await initDb();
};
const readiness = createReadiness({ initialize, probe:() => query('SELECT 1') });
const unavailable = (res) => res.status(503).set('Retry-After','30').json({ error:'伙伴空间暂时无法连接，请稍后重试。', code:'SERVICE_UNAVAILABLE', retryAfter:30 });
app.use((req, res, next) => {
  if (req.path.startsWith('/api') && req.headers.origin === 'null') {
    res.setHeader('Access-Control-Allow-Origin', 'null');
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
  }
  next();
});
app.use(express.json({ limit: '1mb' }));
app.get('/healthz', (_req, res) => res.json({ok:true,service:'website'}));
app.get('/api/health', (_req, res) => res.status(readiness.ready ? 200 : 503).set('Cache-Control','no-store').json({ok:readiness.ready,store:isMemory?(process.env.NODE_ENV==='production'?'unconfigured':'memory'):'postgres',website:'available',sync:readiness.ready?'available':'unavailable'}));

app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    // 轻量访问日志
    console.log(`${req.method} ${req.path}`);
  }
  next();
});

app.use('/api', (req,res,next) => {
  if (req.path === '/release' || readiness.ready) return next();
  return unavailable(res);
});
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/pair', require('./routes/pair.routes'));
app.use('/api/tasks', require('./routes/tasks.routes'));
app.use('/api/status', require('./routes/status.routes'));
app.use('/api/reviews', require('./routes/reviews.routes'));
app.use('/api/slack', require('./routes/slacking.routes'));
app.get('/api/release', async (_req, res, next) => {
  try { res.set('Cache-Control','public, max-age=60').json(await latestRelease()); } catch (err) { next(err); }
});
app.get('/download/windows', async (_req, res, next) => {
  try { res.set('Cache-Control','no-store').redirect(302, (await latestRelease()).url); } catch (err) { next(err); }
});

const publicDir = path.join(__dirname, '..', 'public');
app.use('/widget', express.static(path.join(__dirname, '..', 'widget')));
app.use(express.static(publicDir));

// Marketing is the default. The previous browser workspace remains at /app/.
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// 统一错误处理
app.use((err, req, res, next) => {
  if (isConnectionError(err)) { readiness.unavailable(err); return unavailable(res); }
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 500 ? err.status : 500;
  if (status === 500) console.error('请求处理失败', {code:err.code || 'INTERNAL_ERROR'});
  res.status(status).json({ error: status === 500 ? '服务器暂时无法处理，请稍后重试' : err.message });
});

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';

// Bind HTTP before initializing PostgreSQL: the website and downloads must stay
// available while the stateful service reconnects. Never use an empty memory DB
// as a production fallback.
module.exports = new Promise((resolve, reject) => {
  const server = app.listen(port, host);
  server.once('listening', () => {
    console.log(`Couple Connect running at http://${host}:${server.address().port} (store: ${isMemory?'memory':'postgres'})`);
    void readiness.start().then(() => resolve(server));
  });
  server.once('error', reject);
  server.once('close', () => readiness.stop());
});
