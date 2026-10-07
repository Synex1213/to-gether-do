'use strict';

const content = document.getElementById('content');
const toastEl = document.getElementById('toast');

const state = {
  config: null,
  token: localStorage.getItem('token') || '',
  me: null,
  pairInfo: null,
  partner: null,
  tasks: [],
  myStatus: null,
  partnerStatus: null,
  slackStats: {},
  phase: 'setup',
  authTab: 'login',
  reviewOpenTaskId: null,
  reviewEmoji: 'cheer',
};

const EMOJI = { kiss: '😘', hug: '🤗', cheer: '💪', knock: '💢' };
const MOODS = [
  { k: 'normal', label: '😐 平常' },
  { k: 'happy', label: '😊 开心' },
  { k: 'tired', label: '😴 有点累' },
  { k: 'missyou', label: '🥺 想你了' },
  { k: 'emo', label: '😢 emo' },
];
const FOCUS = [
  { k: 'available', label: '🟢 可打扰' },
  { k: 'focusing', label: '🎯 专注中' },
  { k: 'slacking', label: '🐟 摸鱼中' },
];
const ACTIVITY = [
  { k: 'idle', label: '待着' },
  { k: 'study', label: '学习' },
  { k: 'work', label: '工作' },
  { k: 'eat', label: '吃饭' },
  { k: 'sleep', label: '睡觉' },
  { k: 'commute', label: '通勤' },
];

// 东八区今天，与后端一致
function today() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

async function api(path, opts = {}) {
  const base = ((state.config && state.config.apiBase) || '').replace(/\/$/, '');
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
  const res = await fetch(base + path, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `请求失败 (${res.status})`);
  return data;
}

async function loadConfig() {
  state.config = await window.widget.getConfig();
}
async function saveConfig(patch) {
  state.config = await window.widget.setConfig(patch);
}

function labelOf(list, k) {
  const f = list.find((x) => x.k === k);
  return f ? f.label : k;
}
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtTime(iso) {
  try {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch (e) {
    return '';
  }
}

// ===== 渲染 =====
function render() {
  if (!state.config || !state.config.apiBase) state.phase = 'setup';
  else if (!state.token) state.phase = 'auth';
  else if (!state.pairInfo || state.pairInfo.status !== 'active') state.phase = 'pair';
  else state.phase = 'main';

  if (state.phase === 'setup') renderSetup();
  else if (state.phase === 'auth') renderAuth();
  else if (state.phase === 'pair') renderPair();
  else renderMain();
}

function renderSetup() {
  content.innerHTML = `
    <div class="card">
      <div class="card-title">🔧 配置服务地址</div>
      <div class="setup-hint">
        请填入你部署在 Render 上的应用地址，例如<br>
        <code>https://couple-connect-xxxx.onrender.com</code><br>
        （末尾不要加斜杠）
      </div>
      <div class="field">
        <label class="label">API 地址</label>
        <input class="input" id="setup-api" placeholder="https://..." value="${escapeHtml(state.config?.apiBase || '')}">
      </div>
      <button class="btn btn-block" id="setup-save">保存并继续</button>
    </div>
  `;
}

function renderAuth() {
  content.innerHTML = `
    <div class="card">
      <div class="tabs">
        <div class="tab ${state.authTab === 'login' ? 'active' : ''}" data-tab="login">登录</div>
        <div class="tab ${state.authTab === 'register' ? 'active' : ''}" data-tab="register">注册</div>
      </div>
      <div class="field"><label class="label">用户名</label><input class="input" id="auth-username" placeholder="2-20 位"></div>
      <div class="field"><label class="label">密码</label><input class="input" id="auth-password" type="password" placeholder="至少 6 位"></div>
      ${state.authTab === 'register' ? '<div class="field"><label class="label">昵称</label><input class="input" id="auth-display" placeholder="显示名"></div>' : ''}
      <button class="btn btn-block" id="auth-submit">${state.authTab === 'login' ? '登录' : '注册'}</button>
    </div>
  `;
}

function renderPair() {
  const waiting = state.pairInfo && state.pairInfo.status === 'waiting';
  const myCode = waiting ? state.pairInfo.code : null;
  content.innerHTML = `
    <div class="card">
      <div class="card-title">🤝 绑定伙伴</div>
      ${myCode ? `
        <div class="muted text-center">把你的配对码发给 TA</div>
        <div class="pair-code">${myCode}</div>
        <div class="muted text-center mb8">等待 TA 加入…</div>
        <button class="btn btn-ghost btn-block btn-sm" id="pair-refresh">刷新状态</button>
      ` : `
        <button class="btn btn-block mb8" id="pair-create">生成我的配对码</button>
        <div class="muted text-center mb8">—— 或 ——</div>
        <div class="field"><label class="label">输入 TA 的配对码</label>
        <input class="input" id="pair-code-input" placeholder="6 位码" maxlength="6"></div>
        <button class="btn btn-ghost btn-block" id="pair-join">加入</button>
      `}
    </div>
  `;
}

function renderMain() {
  const myStatus = state.myStatus || {};
  const partnerStatus = state.partnerStatus || {};
  const myTasks = state.tasks.filter((t) => t.owner_id === state.me.id);
  const partnerTasks = state.tasks.filter((t) => t.owner_id === state.partner.id);
  const myDone = myTasks.filter((t) => t.is_completed).length;
  const partnerDone = partnerTasks.filter((t) => t.is_completed).length;
  const partnerName = (state.partner && state.partner.displayName) || 'TA';

  content.innerHTML = `
    <div class="card">
      <div class="partner-card">
        <div class="partner-avatar">${escapeHtml((partnerName || '?')[0])}</div>
        <div class="partner-info">
          <div class="partner-name">${escapeHtml(partnerName)} ${partnerStatus.online ? '<span class="online-dot"></span><span class="muted">在线</span>' : '<span class="muted">离线</span>'}</div>
          <div class="partner-meta">${labelOf(MOODS, partnerStatus.mood)} · ${labelOf(FOCUS, partnerStatus.focus)} · ${labelOf(ACTIVITY, partnerStatus.activity)}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">我的状态</div>
      <div class="status-row">
        ${FOCUS.map((f) => `<span class="chip ${myStatus.focus === f.k ? 'active' : ''} ${f.k === 'slacking' ? 'slacking' : ''}" data-set-focus="${f.k}">${f.label}</span>`).join('')}
      </div>
      <div class="status-row">
        ${ACTIVITY.map((a) => `<span class="chip ${myStatus.activity === a.k ? 'active' : ''}" data-set-activity="${a.k}">${a.label}</span>`).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card-title">🐟 摸鱼 & 抓包</div>
      <div class="slack-row">
        ${myStatus.focus === 'slacking'
          ? '<button class="btn btn-ghost" id="slack-stop">结束摸鱼</button>'
          : '<button class="btn" id="slack-start">偷偷摸个鱼 🐟</button>'}
        ${partnerStatus.focus === 'slacking'
          ? '<button class="btn btn-danger" id="slack-catch">抓 TA！🎯</button>'
          : '<button class="btn btn-ghost" disabled>TA 很乖</button>'}
      </div>
      <div class="slack-stats">
        <div class="slack-stat"><div class="slack-num">${state.slackStats[state.me.id] || 0}</div><div class="slack-label">我被抓</div></div>
        <div class="slack-stat"><div class="slack-num">${state.slackStats[state.partner.id] || 0}</div><div class="slack-label">TA 被抓</div></div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">✅ 我今天 (${myDone}/${myTasks.length})</div>
      <div class="task-add">
        <input class="input" id="task-input" placeholder="给自己加一个任务…">
        <button class="btn" id="task-add">添加</button>
      </div>
      ${myTasks.length ? myTasks.map(renderTaskItem).join('') : '<div class="empty">还没有任务</div>'}
    </div>

    <div class="card">
      <div class="card-title">👀 TA 今天 (${partnerDone}/${partnerTasks.length})</div>
      ${partnerTasks.length ? partnerTasks.map(renderTaskItem).join('') : '<div class="empty">TA 还没有定任务</div>'}
    </div>
  `;
}

function renderTaskItem(t) {
  const isMine = t.owner_id === state.me.id;
  const review = (t.reviews && t.reviews[0]) || null;
  const open = state.reviewOpenTaskId === t.id;
  return `
    <div class="task-item">
      ${isMine ? `<div class="task-check ${t.is_completed ? 'done' : ''}" data-toggle="${t.id}"></div>` : `<div class="task-check ${t.is_completed ? 'done' : ''}" style="cursor:default"></div>`}
      <div class="task-body">
        <div class="task-text ${t.is_completed ? 'done' : ''}">${escapeHtml(t.content)}</div>
        ${t.completed_at ? `<div class="task-meta">完成于 ${fmtTime(t.completed_at)}</div>` : ''}
        ${review ? `<div class="review-box"><span class="review-emoji">${EMOJI[review.emoji] || ''}</span>${escapeHtml(review.comment || '')}</div>` : ''}
        ${open ? `
          <div class="review-editor">
            <div class="review-emojis">
              ${Object.entries(EMOJI).map(([k, v]) => `<button class="review-emoji-btn ${state.reviewEmoji === k ? 'active' : ''}" data-emoji="${k}">${v}</button>`).join('')}
            </div>
            <input class="input" id="review-comment" placeholder="留一句话…" value="${review ? escapeHtml(review.comment || '') : ''}">
            <div class="mt8" style="display:flex;gap:6px">
              <button class="btn btn-sm" data-review-submit="${t.id}">提交批阅</button>
              <button class="btn btn-ghost btn-sm" data-review-cancel>取消</button>
            </div>
          </div>
        ` : ''}
      </div>
      <div class="task-actions">
        ${!isMine ? `<button class="icon-btn" title="批阅" data-review-open="${t.id}">✏️</button>` : ''}
        ${isMine ? `<button class="icon-btn" title="删除" data-task-del="${t.id}">🗑</button>` : ''}
      </div>
    </div>
  `;
}

// ===== 数据加载 =====
async function refreshAll() {
  try {
    const [meRes, pairRes, tasksRes, statusRes, slackRes] = await Promise.all([
      api('/api/auth/me'),
      api('/api/pair/'),
      api('/api/tasks?date=' + today()),
      api('/api/status'),
      api('/api/slack/stats'),
    ]);
    state.me = meRes.user;
    state.pairInfo = pairRes;
    state.partner = pairRes.partner || null;
    state.tasks = tasksRes.tasks || [];
    state.myStatus = statusRes.mine;
    state.partnerStatus = statusRes.theirs;
    state.slackStats = slackRes.stats || {};
  } catch (e) {
    console.warn('refresh failed', e.message);
  }
  render();
}

// ===== 事件 =====
content.addEventListener('click', async (e) => {
  const t = e.target;

  if (t.id === 'setup-save') {
    const val = document.getElementById('setup-api').value.trim();
    if (!val) { toast('请填入 API 地址'); return; }
    await saveConfig({ apiBase: val });
    toast('已保存');
    render();
    return;
  }

  if (t.dataset.tab) { state.authTab = t.dataset.tab; render(); return; }

  if (t.id === 'auth-submit') {
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value;
    if (!username || !password) { toast('请填写用户名和密码'); return; }
    try {
      let r;
      if (state.authTab === 'login') {
        r = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
      } else {
        const displayName = (document.getElementById('auth-display')?.value || '').trim() || username;
        r = await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, password, displayName }) });
      }
      state.token = r.token;
      localStorage.setItem('token', r.token);
      state.me = r.user;
      toast('成功');
      await refreshAll();
    } catch (err) { toast(err.message); }
    return;
  }

  if (t.id === 'pair-create') {
    try {
      const r = await api('/api/pair/code', { method: 'POST' });
      state.pairInfo = { status: r.status || 'waiting', code: r.code };
      render();
    } catch (err) { toast(err.message); }
    return;
  }
  if (t.id === 'pair-join') {
    const code = document.getElementById('pair-code-input').value.trim().toUpperCase();
    if (!code) { toast('请输入配对码'); return; }
    try {
      const r = await api('/api/pair/join', { method: 'POST', body: JSON.stringify({ code }) });
      state.pairInfo = r;
      state.partner = r.partner;
      toast('配对成功');
      await refreshAll();
    } catch (err) { toast(err.message); }
    return;
  }
  if (t.id === 'pair-refresh') { await refreshAll(); return; }

  if (t.dataset.setFocus) {
    try { await api('/api/status', { method: 'PUT', body: JSON.stringify({ focus: t.dataset.setFocus }) }); await refreshAll(); } catch (err) { toast(err.message); }
    return;
  }
  if (t.dataset.setActivity) {
    try { await api('/api/status', { method: 'PUT', body: JSON.stringify({ activity: t.dataset.setActivity }) }); await refreshAll(); } catch (err) { toast(err.message); }
    return;
  }

  if (t.id === 'slack-start') {
    try { await api('/api/status', { method: 'PUT', body: JSON.stringify({ focus: 'slacking' }) }); toast('开始摸鱼 🐟'); await refreshAll(); } catch (err) { toast(err.message); }
    return;
  }
  if (t.id === 'slack-stop') {
    try { await api('/api/status', { method: 'PUT', body: JSON.stringify({ focus: 'available' }) }); await refreshAll(); } catch (err) { toast(err.message); }
    return;
  }
  if (t.id === 'slack-catch') {
    try { const r = await api('/api/slack/catch', { method: 'POST' }); toast(r.message || '抓包成功！'); await refreshAll(); } catch (err) { toast(err.message); }
    return;
  }

  if (t.id === 'task-add') { await addTask(); return; }
  if (t.dataset.toggle) {
    const task = state.tasks.find((x) => x.id === t.dataset.toggle);
    try {
      await api('/api/tasks/' + t.dataset.toggle, { method: 'PATCH', body: JSON.stringify({ isCompleted: !task.is_completed }) });
      await refreshAll();
    } catch (err) { toast(err.message); }
    return;
  }
  if (t.dataset.taskDel) {
    if (!confirm('删除这个任务？')) return;
    try { await api('/api/tasks/' + t.dataset.taskDel, { method: 'DELETE' }); await refreshAll(); } catch (err) { toast(err.message); }
    return;
  }

  if (t.dataset.reviewOpen) { state.reviewOpenTaskId = t.dataset.reviewOpen; state.reviewEmoji = 'cheer'; render(); return; }
  if (t.dataset.reviewCancel) { state.reviewOpenTaskId = null; render(); return; }
  if (t.dataset.emoji) { state.reviewEmoji = t.dataset.emoji; render(); return; }
  if (t.dataset.reviewSubmit) {
    const comment = document.getElementById('review-comment').value.trim();
    try {
      await api('/api/reviews', { method: 'PUT', body: JSON.stringify({ task_id: t.dataset.reviewSubmit, emoji: state.reviewEmoji, comment }) });
      state.reviewOpenTaskId = null;
      toast('批阅已发送');
      await refreshAll();
    } catch (err) { toast(err.message); }
    return;
  }
});

content.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  if (e.target.id === 'task-input') addTask();
  if (e.target.id === 'auth-username' || e.target.id === 'auth-password' || e.target.id === 'auth-display') {
    document.getElementById('auth-submit')?.click();
  }
  if (e.target.id === 'pair-code-input') document.getElementById('pair-join')?.click();
});

async function addTask() {
  const input = document.getElementById('task-input');
  const text = input.value.trim();
  if (!text) return;
  try {
    await api('/api/tasks', { method: 'POST', body: JSON.stringify({ content: text, date: today() }) });
    input.value = '';
    await refreshAll();
  } catch (err) { toast(err.message); }
}

// 标题栏
document.getElementById('btn-min').addEventListener('click', () => window.widget.minimize());
document.getElementById('btn-close').addEventListener('click', () => window.widget.hide());

// 轮询
setInterval(() => { if (state.phase === 'main') refreshAll(); }, 15000);

// 启动
(async () => {
  await loadConfig();
  if (state.token) {
    try { await refreshAll(); } catch (e) { render(); }
  } else {
    render();
  }
})();
