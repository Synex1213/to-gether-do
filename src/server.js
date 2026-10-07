'use strict';

const express = require('express');
const path = require('path');
const { initDb, isMemory } = require('./db');

const app = express();
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

app.get('/api/health', (req, res) =>
  res.json({ ok: true, store: isMemory ? 'memory' : 'postgres' })
);

const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// SPA 回退：非 /api 请求统一返回 index.html
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

initDb()
  .then(() => {
    app.listen(port, host, () => {
      console.log(
        `Couple Connect running at http://${host}:${port} (store: ${
          isMemory ? 'memory' : 'postgres'
        })`
      );
    });
  })
  .catch((e) => {
    console.error('启动失败：', e);
    process.exit(1);
  });
