'use strict';

const router = require('express').Router();
const crypto = require('crypto');
const wrap = require('../wrap');
const { query, one } = require('../db');
const { authMiddleware } = require('../auth');
const { requirePair, touchActive, publicUser } = require('../pair-util');

router.use(authMiddleware);

// 东八区“今天”
function todayStr() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

// 查看某天两人的任务与批阅
router.get(
  '/',
  wrap(async (req, res) => {
    const { pair, partnerId } = await requirePair(req.user.id);
    await touchActive(req.user.id);
    const date = (req.query.date || todayStr()).slice(0, 10);

    const tasks = await query(
      `SELECT * FROM tasks WHERE pair_id = $1 AND task_date = $2
       ORDER BY owner_id, sort_order, created_at`,
      [pair.id, date]
    );

    // 一次 JOIN 取当天所有批阅，避免动态 IN
    const reviewRows = await query(
      `SELECT r.* FROM reviews r
       JOIN tasks t ON t.id = r.task_id
       WHERE t.pair_id = $1 AND t.task_date = $2
       ORDER BY r.created_at`,
      [pair.id, date]
    );
    const reviewsByTask = {};
    reviewRows.forEach((r) => {
      (reviewsByTask[r.task_id] = reviewsByTask[r.task_id] || []).push(r);
    });
    tasks.forEach((t) => {
      t.reviews = reviewsByTask[t.id] || [];
    });

    // 完成进度
    const progress = {
      [req.user.id]: { total: 0, done: 0 },
      [partnerId]: { total: 0, done: 0 },
    };
    tasks.forEach((t) => {
      const p = progress[t.owner_id];
      if (p) {
        p.total += 1;
        if (t.is_completed) p.done += 1;
      }
    });

    const [me, partner] = await Promise.all([
      publicUser(req.user.id),
      publicUser(partnerId),
    ]);

    res.json({
      date,
      tasks,
      progress,
      users: {
        me: { id: me.id, username: me.username, displayName: me.display_name },
        partner: { id: partner.id, username: partner.username, displayName: partner.display_name },
      },
    });
  })
);

// 新增任务
router.post(
  '/',
  wrap(async (req, res) => {
    const { pair } = await requirePair(req.user.id);
    await touchActive(req.user.id);
    const content = ((req.body && req.body.content) || '').trim();
    const date = ((req.body && req.body.date) || todayStr()).slice(0, 10);
    if (!content) return res.status(400).json({ error: '任务内容不能为空' });
    if (content.length > 500) return res.status(400).json({ error: '任务内容过长（≤500 字）' });

    const row = await one(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next
       FROM tasks WHERE owner_id = $1 AND task_date = $2`,
      [req.user.id, date]
    );
    const id = crypto.randomUUID();
    await query(
      `INSERT INTO tasks (id, owner_id, pair_id, task_date, content, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, req.user.id, pair.id, date, content, row.next]
    );
    const task = await one(`SELECT * FROM tasks WHERE id = $1`, [id]);
    task.reviews = [];
    res.json({ task });
  })
);

// 修改任务（内容 / 完成状态）
router.patch(
  '/:id',
  wrap(async (req, res) => {
    await requirePair(req.user.id);
    await touchActive(req.user.id);
    const task = await one(`SELECT * FROM tasks WHERE id = $1`, [req.params.id]);
    if (!task) return res.status(404).json({ error: '任务不存在' });
    if (task.owner_id !== req.user.id)
      return res.status(403).json({ error: '只能修改自己的任务' });

    const body = req.body || {};
    const fields = [];
    const vals = [];
    let i = 1;

    if (typeof body.content === 'string') {
      const content = body.content.trim();
      if (!content) return res.status(400).json({ error: '任务内容不能为空' });
      fields.push(`content = $${i++}`);
      vals.push(content);
    }
    if (typeof body.isCompleted === 'boolean') {
      fields.push(`is_completed = $${i++}`);
      vals.push(body.isCompleted);
      if (body.isCompleted && !task.is_completed) {
        fields.push(`completed_at = now()`);
      } else if (!body.isCompleted && task.is_completed) {
        fields.push(`completed_at = NULL`);
      }
    }
    if (fields.length === 0) return res.json({ task });

    fields.push(`updated_at = now()`);
    vals.push(req.params.id);
    const updated = await one(
      `UPDATE tasks SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      vals
    );
    const reviewRows = await query(`SELECT * FROM reviews WHERE task_id = $1`, [
      updated.id,
    ]);
    updated.reviews = reviewRows;
    res.json({ task: updated });
  })
);

// 删除任务（连同批阅）
router.delete(
  '/:id',
  wrap(async (req, res) => {
    await requirePair(req.user.id);
    const task = await one(`SELECT * FROM tasks WHERE id = $1`, [req.params.id]);
    if (!task) return res.status(404).json({ error: '任务不存在' });
    if (task.owner_id !== req.user.id)
      return res.status(403).json({ error: '只能删除自己的任务' });

    await query(`DELETE FROM reviews WHERE task_id = $1`, [task.id]);
    await query(`DELETE FROM tasks WHERE id = $1 AND owner_id = $2`, [
      task.id,
      req.user.id,
    ]);
    res.json({ ok: true });
  })
);

module.exports = router;
