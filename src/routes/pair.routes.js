'use strict';

const router = require('express').Router();
const crypto = require('crypto');
const wrap = require('../wrap');
const { query, one } = require('../db');
const { authMiddleware } = require('../auth');
const { getActivePair, touchActive, publicUser } = require('../pair-util');

router.use(authMiddleware);

function genCode() {
  // 去除易混字符 I / O / 0 / 1
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(6);
  let out = '';
  for (let i = 0; i < 6; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

// 生成我的配对码
router.post(
  '/code',
  wrap(async (req, res) => {
    await touchActive(req.user.id);
    const active = await getActivePair(req.user.id);
    if (active) return res.status(400).json({ error: '你已经配对过了' });

    const existing = await one(
      `SELECT * FROM pairs WHERE user_a = $1 AND status = 'pending'
       ORDER BY created_at DESC LIMIT 1`,
      [req.user.id]
    );
    if (existing) return res.json({ code: existing.pair_code, status: 'pending' });

    let code;
    for (let i = 0; i < 5; i++) {
      code = genCode();
      const clash = await one(`SELECT id FROM pairs WHERE pair_code = $1`, [code]);
      if (!clash) break;
    }
    const id = crypto.randomUUID();
    await query(
      `INSERT INTO pairs (id, user_a, pair_code, status)
       VALUES ($1, $2, $3, 'pending')`,
      [id, req.user.id, code]
    );
    res.json({ code, status: 'pending' });
  })
);

// 输入对方配对码加入
router.post(
  '/join',
  wrap(async (req, res) => {
    await touchActive(req.user.id);
    const code = ((req.body && req.body.code) || '').trim().toUpperCase();
    if (code.length !== 6) return res.status(400).json({ error: '配对码为 6 位' });

    const active = await getActivePair(req.user.id);
    if (active) return res.status(400).json({ error: '你已经配对过了' });

    const pair = await one(
      `SELECT * FROM pairs WHERE pair_code = $1 AND status = 'pending'`,
      [code]
    );
    if (!pair) return res.status(404).json({ error: '配对码无效或已被使用' });
    if (pair.user_a === req.user.id)
      return res.status(400).json({ error: '不能和自己配对哦' });

    await query(
      `UPDATE pairs SET user_b = $1, status = 'active', paired_at = now() WHERE id = $2`,
      [req.user.id, pair.id]
    );
    const partner = await publicUser(pair.user_a);
    res.json({
      status: 'active',
      partner: { id: partner.id, username: partner.username, displayName: partner.display_name },
    });
  })
);

// 查询我的配对状态
router.get(
  '/',
  wrap(async (req, res) => {
    await touchActive(req.user.id);
    const active = await getActivePair(req.user.id);
    if (active) {
      const partner = await publicUser(active.partnerId);
      return res.json({
        status: 'active',
        partner: partner
          ? { id: partner.id, username: partner.username, displayName: partner.display_name }
          : null,
      });
    }
    const pending = await one(
      `SELECT * FROM pairs WHERE user_a = $1 AND status = 'pending'
       ORDER BY created_at DESC LIMIT 1`,
      [req.user.id]
    );
    if (pending) return res.json({ status: 'waiting', code: pending.pair_code });
    res.json({ status: 'none' });
  })
);

module.exports = router;
