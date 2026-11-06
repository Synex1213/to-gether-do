'use strict';

const router = require('express').Router();
const wrap = require('../wrap');
const { query, one } = require('../db');
const { authMiddleware } = require('../auth');
const { requirePair, touchActive, publicUser } = require('../pair-util');
const { statusExpired } = require('../status-util');

router.use(authMiddleware);

const MOODS = ['normal', 'happy', 'tired', 'missyou', 'emo'];
const FOCUS = ['available', 'focusing', 'slacking'];
const ACTIVITY = ['idle', 'study', 'work', 'eat', 'sleep', 'commute'];

function decorate(s) {
  const online = Date.now() - new Date(s.last_active_at).getTime() <= 120000;
  return { ...s, online, expired: statusExpired(s) };
}

// 查看两人状态
router.get(
  '/',
  wrap(async (req, res) => {
    const { partnerId } = await requirePair(req.user.id);
    await touchActive(req.user.id);

    let mine = await one(`SELECT * FROM statuses WHERE user_id = $1`, [req.user.id]);
    if (!mine) {
      await query(`INSERT INTO statuses (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [
        req.user.id,
      ]);
      mine = await one(`SELECT * FROM statuses WHERE user_id = $1`, [req.user.id]);
    }
    let theirs = await one(`SELECT * FROM statuses WHERE user_id = $1`, [partnerId]);
    if (!theirs) {
      theirs = {
        user_id: partnerId,
        mood: 'normal',
        focus: 'available',
        activity: 'idle',
        custom_activity: null,
        last_active_at: new Date(0).toISOString(),
      };
    }

    const [me, partner] = await Promise.all([
      publicUser(req.user.id),
      publicUser(partnerId),
    ]);

    res.json({
      mine: { ...decorate(mine), user: { id: me.id, displayName: me.display_name } },
      theirs: {
        ...decorate(theirs),
        user: { id: partner.id, displayName: partner.display_name },
      },
    });
  })
);

// 更新我的状态
router.put(
  '/',
  wrap(async (req, res) => {
    await requirePair(req.user.id);
    await touchActive(req.user.id);
    const body = req.body || {};
    if (Object.hasOwn(body, 'durationMinutes') && ![0, 30, 60, 120].includes(body.durationMinutes)) {
      return res.status(400).json({ error: '状态有效期请选择不限、30、60 或 120 分钟' });
    }

    await query(`INSERT INTO statuses (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [
      req.user.id,
    ]);

    const sets = [];
    const vals = [];
    let i = 1;
    if (MOODS.includes(body.mood)) {
      sets.push(`mood = $${i++}`);
      vals.push(body.mood);
    }
    if (FOCUS.includes(body.focus)) {
      sets.push(`focus = $${i++}`);
      vals.push(body.focus);
    }
    if (ACTIVITY.includes(body.activity)) {
      sets.push(`activity = $${i++}`);
      vals.push(body.activity);
    }
    if (typeof body.customActivity === 'string') {
      const c = body.customActivity.trim().slice(0, 100);
      sets.push(`custom_activity = $${i++}`);
      vals.push(c || null);
    }

    // Old clients that publish a new activity also clear the previous deadline.
    // Mood-only changes keep the activity deadline, even if it has expired.
    if (FOCUS.includes(body.focus) || ACTIVITY.includes(body.activity) || typeof body.customActivity === 'string' || Object.hasOwn(body, 'durationMinutes')) {
      sets.push(`expires_at = $${i++}`);
      vals.push(body.durationMinutes ? new Date(Date.now() + body.durationMinutes * 60000).toISOString() : null);
    }
    if (sets.length > 0) {
      sets.push(`updated_at = now()`);
      vals.push(req.user.id);
      await query(`UPDATE statuses SET ${sets.join(', ')} WHERE user_id = $${i}`, vals);
    }
    const updated = await one(`SELECT * FROM statuses WHERE user_id = $1`, [
      req.user.id,
    ]);
    res.json({ status: decorate(updated) });
  })
);

module.exports = router;
