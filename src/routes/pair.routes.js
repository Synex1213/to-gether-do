'use strict';
const router = require('express').Router();
const crypto = require('crypto');
const wrap = require('../wrap');
const { one, transaction, isMemory } = require('../db');
const { authMiddleware } = require('../auth');
const { getActivePair, touchActive, publicUser } = require('../pair-util');
router.use(authMiddleware);

function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}
async function lockUsers(tx, ids) {
  // Sorted locks also cover the same person joining two different invitations.
  for (const id of [...new Set(ids)].sort()) {
    await tx.one('SELECT id FROM users WHERE id = $1' + (isMemory ? '' : ' FOR UPDATE'), [id]);
  }
}
async function active(tx, id) {
  return tx.one("SELECT * FROM pairs WHERE status = 'active' AND (user_a = $1 OR user_b = $1)", [id]);
}
function genCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.randomBytes(6), b => alphabet[b % alphabet.length]).join('');
}
router.post('/code', wrap(async (req, res) => {
  const result = await transaction(async tx => {
    await lockUsers(tx, [req.user.id]);
    if (await active(tx, req.user.id)) fail('你已经有伙伴了，请先解除当前绑定');
    const existing = await tx.one("SELECT * FROM pairs WHERE user_a = $1 AND status = 'pending' ORDER BY created_at DESC LIMIT 1", [req.user.id]);
    if (existing) return { code: existing.pair_code, status: 'waiting' };
    for (let i = 0; i < 5; i++) {
      const code = genCode();
      const inserted = await tx.one("INSERT INTO pairs (id, user_a, pair_code, status) VALUES ($1, $2, $3, 'pending') ON CONFLICT (pair_code) DO NOTHING RETURNING id", [crypto.randomUUID(), req.user.id, code]);
      if (inserted) return { code, status: 'waiting' };
    }
    fail('暂时无法生成配对码，请重试', 503);
  });
  res.json(result);
}));
router.post('/join', wrap(async (req, res) => {
  const code = typeof req.body.code === 'string' ? req.body.code.trim().toUpperCase() : '';
  if (!/^[A-Z2-9]{6}$/.test(code)) fail('请输入有效的 6 位配对码');
  const invitation = await one("SELECT * FROM pairs WHERE pair_code = $1 AND status = 'pending'", [code]);
  if (!invitation) fail('配对码无效或已被使用', 404);
  if (invitation.user_a === req.user.id) fail('不能和自己配对哦');
  await transaction(async tx => {
    await lockUsers(tx, [invitation.user_a, req.user.id]);
    if (await active(tx, req.user.id)) fail('你已经有伙伴了，请先解除当前绑定');
    if (await active(tx, invitation.user_a)) fail('对方已经有伙伴了，此配对码已失效');
    const joined = await tx.one("UPDATE pairs SET user_b = $1, status = 'active', paired_at = now() WHERE id = $2 AND status = 'pending' RETURNING id", [req.user.id, invitation.id]);
    if (!joined) fail('配对码已被使用', 409);
    await tx.query("UPDATE pairs SET status = 'cancelled' WHERE status = 'pending' AND (user_a = $1 OR user_a = $2)", [req.user.id, invitation.user_a]);
    // A new partner only sees status shared after this new relationship begins.
    await tx.query("UPDATE statuses SET activity = 'idle', focus = 'available', mood = 'normal', custom_activity = NULL, expires_at = NULL, updated_at = now() WHERE user_id = $1 OR user_id = $2", [req.user.id, invitation.user_a]);
  });
  const partner = await publicUser(invitation.user_a);
  res.json({ status: 'active', partner: { id: partner.id, username: partner.username, displayName: partner.display_name } });
}));
router.delete('/', wrap(async (req, res) => {
  const current = await getActivePair(req.user.id);
  await transaction(async tx => {
    await lockUsers(tx, current ? [req.user.id, current.partnerId] : [req.user.id]);
    // Only end the relationship observed before taking locks, never a newer one.
    if (current) await tx.query("UPDATE pairs SET status = 'ended' WHERE id = $1 AND status = 'active'", [current.pair.id]);
    await tx.query("UPDATE pairs SET status = 'cancelled' WHERE user_a = $1 AND status = 'pending'", [req.user.id]);
  });
  res.json({ ok: true });
}));
router.get('/', wrap(async (req, res) => {
  await touchActive(req.user.id);
  const current = await getActivePair(req.user.id);
  if (current) {
    const partner = await publicUser(current.partnerId);
    return res.json({ status: 'active', pairId: current.pair.id, partner: partner ? { id: partner.id, username: partner.username, displayName: partner.display_name } : null });
  }
  const pending = await one("SELECT * FROM pairs WHERE user_a = $1 AND status = 'pending' ORDER BY created_at DESC LIMIT 1", [req.user.id]);
  res.json(pending ? { status: 'waiting', code: pending.pair_code } : { status: 'none' });
}));
module.exports = router;
