'use strict';

const router = require('express').Router();
const crypto = require('crypto');
const wrap = require('../wrap');
const { query, one } = require('../db');
const { authMiddleware } = require('../auth');
const { requirePair, touchActive } = require('../pair-util');

router.use(authMiddleware);

const COOLDOWN_MS = 5 * 60 * 1000; // 抓包冷却 5 分钟

// 抓包：TA 必须处于摸鱼状态
router.post(
  '/catch',
  wrap(async (req, res) => {
    const { pair, partnerId } = await requirePair(req.user.id);
    await touchActive(req.user.id);
    const caughtId = (req.body && req.body.caughtId) || partnerId;
    if (caughtId !== partnerId)
      return res.status(400).json({ error: '只能抓 TA' });

    const target = await one(`SELECT * FROM statuses WHERE user_id = $1`, [partnerId]);
    if (!target || target.focus !== 'slacking')
      return res.status(400).json({ error: 'TA 现在没有在摸鱼，抓不到～' });

    const last = await one(
      `SELECT created_at FROM slacking_catches
       WHERE pair_id = $1 AND catcher_id = $2 AND caught_id = $3
       ORDER BY created_at DESC LIMIT 1`,
      [pair.id, req.user.id, partnerId]
    );
    if (last && Date.now() - new Date(last.created_at).getTime() < COOLDOWN_MS)
      return res.status(429).json({ error: '刚抓过啦，让 TA 缓一会儿（5 分钟冷却）' });

    const id = crypto.randomUUID();
    await query(
      `INSERT INTO slacking_catches (id, caught_id, catcher_id, pair_id, note)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, partnerId, req.user.id, pair.id, '摸鱼被抓现行']
    );
    // 被抓后自动结束摸鱼状态
    await query(
      `UPDATE statuses SET focus = 'available', updated_at = now() WHERE user_id = $1`,
      [partnerId]
    );

    const catchRow = await one(`SELECT * FROM slacking_catches WHERE id = $1`, [id]);
    res.json({ catch: catchRow, message: '抓包成功！TA 摸鱼被你抓了个现行' });
  })
);

// 双方被抓次数
router.get(
  '/stats',
  wrap(async (req, res) => {
    const { pair, partnerId } = await requirePair(req.user.id);
    await touchActive(req.user.id);
    const rows = await query(
      `SELECT caught_id, COUNT(*) AS n FROM slacking_catches
       WHERE pair_id = $1 GROUP BY caught_id`,
      [pair.id]
    );
    const stats = { [req.user.id]: 0, [partnerId]: 0 };
    rows.forEach((r) => {
      stats[r.caught_id] = Number(r.n);
    });
    res.json({ stats });
  })
);

// 被抓历史
router.get(
  '/history',
  wrap(async (req, res) => {
    const { pair } = await requirePair(req.user.id);
    await touchActive(req.user.id);
    const rows = await query(
      `SELECT * FROM slacking_catches WHERE pair_id = $1
       ORDER BY created_at DESC LIMIT 20`,
      [pair.id]
    );
    res.json({ history: rows });
  })
);

module.exports = router;
