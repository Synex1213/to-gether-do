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
    username = (username || '').trim();
    displayName = (displayName || '').trim() || username;
    if (!/^[A-Za-z0-9_一-龥]{2,20}$/.test(username)) {
      return res.status(400).json({ error: '用户名需 2-20 位，可用中英文、数字、下划线' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: '密码至少 6 位' });
    }
    const exists = await one(`SELECT id FROM users WHERE username = $1`, [username]);
    if (exists) {
      return res.status(409).json({ error: '该用户名已被注册' });
    }
    const id = crypto.randomUUID();
    const hash = await hashPassword(password);
    await query(
      `INSERT INTO users (id, username, display_name, password_hash)
       VALUES ($1, $2, $3, $4)`,
      [id, username, displayName, hash]
    );
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
    res.json({ user: { id: user.id, username: user.username, displayName: user.display_name } });
  })
);

module.exports = router;
