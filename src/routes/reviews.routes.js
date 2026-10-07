'use strict';

const router = require('express').Router();
const crypto = require('crypto');
const wrap = require('../wrap');
const { query, one } = require('../db');
const { authMiddleware } = require('../auth');
const { requirePair, touchActive } = require('../pair-util');

router.use(authMiddleware);

const EMOJIS = ['kiss', 'hug', 'cheer', 'knock'];

// 提交/更新批阅（upsert：每人对每条任务一条）
router.put(
  '/',
  wrap(async (req, res) => {
    const { pair, partnerId } = await requirePair(req.user.id);
    await touchActive(req.user.id);

    const taskId = req.body && req.body.taskId;
    let emoji = req.body && req.body.emoji;
    let comment = req.body && req.body.comment;
    if (comment) comment = String(comment).trim().slice(0, 300);
    if (emoji && !EMOJIS.includes(emoji)) emoji = null;

    if (!taskId) return res.status(400).json({ error: '缺少任务' });
    if (!emoji && !comment)
      return res.status(400).json({ error: '选个表情或写点什么吧' });

    const task = await one(`SELECT * FROM tasks WHERE id = $1`, [taskId]);
    if (!task) return res.status(404).json({ error: '任务不存在' });
    if (task.pair_id !== pair.id) return res.status(403).json({ error: '无权批阅该任务' });
    if (task.owner_id !== partnerId)
      return res.status(400).json({ error: '只能批阅 TA 的任务' });

    const existing = await one(
      `SELECT * FROM reviews WHERE task_id = $1 AND reviewer_id = $2`,
      [taskId, req.user.id]
    );

    let review;
    if (existing) {
      const sets = [];
      const vals = [];
      let i = 1;
      if (emoji) {
        sets.push(`emoji = $${i++}`);
        vals.push(emoji);
      }
      if (comment !== undefined) {
        sets.push(`comment = $${i++}`);
        vals.push(comment || null);
      }
      sets.push(`updated_at = now()`);
      vals.push(existing.id);
      review = await one(
        `UPDATE reviews SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
        vals
      );
    } else {
      const id = crypto.randomUUID();
      await query(
        `INSERT INTO reviews (id, task_id, reviewer_id, emoji, comment)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, taskId, req.user.id, emoji || null, comment || null]
      );
      review = await one(`SELECT * FROM reviews WHERE id = $1`, [id]);
    }
    res.json({ review });
  })
);

router.delete(
  '/:id',
  wrap(async (req, res) => {
    await requirePair(req.user.id);
    const r = await one(`SELECT * FROM reviews WHERE id = $1`, [req.params.id]);
    if (!r) return res.status(404).json({ error: '批阅不存在' });
    if (r.reviewer_id !== req.user.id)
      return res.status(403).json({ error: '无权删除这条批阅' });
    await query(`DELETE FROM reviews WHERE id = $1`, [r.id]);
    res.json({ ok: true });
  })
);

module.exports = router;
