'use strict';

const { one, query } = require('./db');

// 返回当前用户的活跃配对；没有则 null
async function getActivePair(userId) {
  const pair = await one(
    `SELECT * FROM pairs
     WHERE status = 'active' AND (user_a = $1 OR user_b = $1)
     LIMIT 1`,
    [userId]
  );
  if (!pair) return null;
  const partnerId = pair.user_a === userId ? pair.user_b : pair.user_a;
  return { pair, partnerId };
}

async function requirePair(userId) {
  const ctx = await getActivePair(userId);
  if (!ctx) {
    const e = new Error('还没有和 TA 配对，请先完成配对');
    e.status = 400;
    throw e;
  }
  return ctx;
}

// 更新最后活跃时间（用于在线状态）
async function touchActive(userId) {
  await query(
    `INSERT INTO statuses (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO UPDATE SET last_active_at = now()`,
    [userId]
  );
}

async function publicUser(id) {
  return one(
    `SELECT id, username, display_name FROM users WHERE id = $1`,
    [id]
  );
}

async function getUserList(ids) {
  const uniq = [...new Set((ids || []).filter(Boolean))];
  return Promise.all(uniq.map((id) => publicUser(id)));
}

module.exports = { getActivePair, requirePair, touchActive, publicUser, getUserList };
