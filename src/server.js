'use strict';

const express = require('express');
const path = require('path');
const { initDb, isMemory } = require('./db');
const { createReleaseResolver } = require('./releases');
const latestRelease = createReleaseResolver();

const app = express();
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

app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    // 轻量访问日志
    console.log(`${req.method} ${req.path}`);
  }
  next();
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

app.get('/api/health', (req, res) =>
  res.json({ ok: true, store: isMemory ? 'memory' : 'postgres' })
);

const publicDir = path.join(__dirname, '..', 'public');
app.use('/widget', express.static(path.join(__dirname, '..', 'widget')));
app.use(express.static(publicDir));

// Marketing is the default. The previous browser workspace remains at /app/.
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// 统一错误处理
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || '服务器开小差了' });
});

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';

module.exports = initDb()
  .then(() => {
    const server = app.listen(port, host, () => {
      console.log(
        `Couple Connect running at http://${host}:${port} (store: ${
          isMemory ? 'memory' : 'postgres'
        })`
      );
    });
    return new Promise((resolve, reject) => {
      server.once('listening', () => resolve(server));
      server.once('error', reject);
    });
  })
  .catch((e) => {
    console.error('启动失败：', e);
    process.exit(1);
  });
