'use strict';

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'dev-secret-change-me');
function requireSecret() {
  if (!SECRET) throw Object.assign(new Error('登录服务暂不可用，请稍后重试'), {status:503});
}

async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

function signToken(user) {
  requireSecret();
  return jwt.sign({ sub: user.id, username: user.username }, SECRET, {
    expiresIn: '30d',
  });
}

function authMiddleware(req, res, next) {
  try { requireSecret(); } catch (error) { return res.status(503).json({error:error.message}); }
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) {
    return res.status(401).json({ error: '未登录' });
  }
  try {
    const payload = jwt.verify(token, SECRET);
    req.user = { id: payload.sub, username: payload.username };
    return next();
  } catch (e) {
    return res.status(401).json({ error: '登录已失效，请重新登录' });
  }
}

module.exports = { hashPassword, verifyPassword, signToken, authMiddleware };
