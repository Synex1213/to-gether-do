'use strict';

const router = require('express').Router();
const crypto = require('crypto');
const wrap = require('../wrap');
const { query, one } = require('../db');
const { hashPassword, verifyPassword, signToken, authMiddleware } = require('../auth');
const { touchActive } = require('../pair-util');

router.post(
  '/register',
  wrap(async (req, res) => {
    let { username, password, displayName } = req.body || {};
    username = typeof username === 'string' ? username.trim() : '';
    if (displayName !== undefined && typeof displayName !== 'string') return res.status(400).json({error:'昵称格式不正确'});
    displayName = (displayName || '').trim() || username;
    if (displayName.length > 24) return res.status(400).json({error:'昵称最多 24 位'});
    if (!/^[A-Za-z0-9_一-龥]{2,20}$/.test(username)) {
      return res.status(400).json({ error: '用户名需 2-20 位，可用中英文、数字、下划线' });
    }
    if (typeof password !== 'string' || password.length < 6 || Buffer.byteLength(password, 'utf8') > 72) {
      return res.status(400).json({ error: '密码至少 6 位，最多 72 字节（中文占 3 字节）' });
    }
    const exists = await one(`SELECT id FROM users WHERE username = $1`, [username]);
    if (exists) {
      return res.status(409).json({ error: '该用户名已被注册' });
    }
    const id = crypto.randomUUID();
    const hash = await hashPassword(password);
    try { await query(
      `INSERT INTO users (id, username, display_name, password_hash)
       VALUES ($1, $2, $3, $4)`,
      [id, username, displayName, hash]
    ); } catch (error) {
      if (error.code === '23505') return res.status(409).json({error:'该用户名已被注册'});
      throw error;
    }
    await query(
      `INSERT INTO statuses (user_id) VALUES ($1) ON CONFLICT DO NOTHING`,
      [id]
    );
    const token = signToken({ id, username });
    res.json({ token, user: { id, username, displayName } });
  })
);

router.post(
  '/login',
  wrap(async (req, res) => {
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || typeof password !== 'string' || username.length > 100 || password.length > 1024) return res.status(400).json({error:'请填写有效的用户名和密码'});
    const user = await one(`SELECT * FROM users WHERE username = $1`, [
      (username || '').trim(),
    ]);
    if (!user || !(await verifyPassword(password || '', user.password_hash))) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    const token = signToken(user);
    res.json({
      token,
      user: { id: user.id, username: user.username, displayName: user.display_name },
    });
  })
);

router.get(
  '/me',
  authMiddleware,
  wrap(async (req, res) => {
    await touchActive(req.user.id);
    const user = await one(
      `SELECT id, username, display_name FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (!user) return res.status(401).json({error:'登录已失效，请重新登录'});
    res.json({ user: { id: user.id, username: user.username, displayName: user.display_name } });
  })
);

module.exports = router;
