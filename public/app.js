'use strict';

/* ---------------- 常量 ---------------- */
const EMOJI_MAP = {
  kiss: { icon: '😘', label: '亲亲' },
  hug: { icon: '🤗', label: '抱抱' },
  cheer: { icon: '💪', label: '加油' },
  knock: { icon: '💢', label: '敲头' },
};
const MOOD_MAP = {
  normal: '😐 平常',
  happy: '😊 开心',
  tired: '😮‍💨 有点累',
  missyou: '🥰 想你了',
  emo: '🥺 emo',
};
const FOCUS_MAP = {
  available: '🟢 可打扰',
  focusing: '🎯 专注中',
  slacking: '🐟 摸鱼中',
};
const ACT_MAP = {
  idle: '💤 待着',
  study: '📚 学习',
  work: '💼 工作',
  eat: '🍚 吃饭',
  sleep: '😴 睡觉',
  commute: '🚌 通勤',
};

/* ---------------- 状态 ---------------- */
const state = {
  token: localStorage.getItem('cc_token'),
  me: null,
  pair: null,
  date: todayStr(),
  data: null,
  status: null,
  slack: null,
  authTab: 'login',
  deferredPrompt: null,
  syncError: false,
};

/* ---------------- 工具 ---------------- */
function pad(n) {
  return String(n).padStart(2, '0');
}
function fmtDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function todayStr() {
  return new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
}
function shiftDate(s, delta) {
  const d = new Date(s + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return fmtDate(d);
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function clockTime(iso) {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function relTime(iso) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  return `${Math.floor(h / 24)} 天前`;
}
function friendlyDate(s) {
  const w = ['日', '一', '二', '三', '四', '五', '六'][new Date(s + 'T00:00:00').getDay()];
  return `${s.slice(5).replace('-', '/')} 周${w}`;
}

let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

async function api(method, p, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch('/api' + p, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try {
    data = await res.json();
  } catch (e) {}
  if (!res.ok) throw Object.assign(new Error(data.error || '请求失败'), { status: res.status });
  return data;
}

/* ---------------- 数据加载 ---------------- */
async function loadMe() {
  const r = await api('GET', '/auth/me');
  state.me = r.user;
}
function loadTasks() {
  return api('GET', '/tasks?date=' + state.date).then((r) => {
    state.data = r;
  });
}
function loadStatus() {
  return api('GET', '/status').then((r) => {
    state.status = r;
  });
}
function loadSlack() {
  return Promise.all([api('GET', '/slack/stats'), api('GET', '/slack/history')]).then(
    ([s, h]) => {
      state.slack = { stats: s.stats, history: h.history };
    }
  );
}
async function refreshAll() {
  const previousPair = state.pair?.pairId;
  state.pair = await api('GET', '/pair');
  if (state.pair.status !== 'active') {
    state.data = null; state.status = null; state.slack = null;
    clearInterval(pollTimer); render();
    if (state.pair.status === 'waiting') startPairPolling();
    return;
  }
  if (previousPair && previousPair !== state.pair.pairId) {
    state.data = null; state.status = null; state.slack = null;
    document.getElementById('app').innerHTML = '';
  }
  await Promise.all([loadTasks(), loadStatus(), loadSlack()]);
}

/* ---------------- 渲染路由 ---------------- */
function render() {
  if (!state.token || !state.me) return renderAuth();
  if (!state.pair || state.pair.status === 'none' || state.pair.status === 'waiting')
    return renderPair();
  if (state.status && state.data && state.slack) return renderMain();
  document.getElementById('app').innerHTML =
    '<div class="center-wrap muted">加载中…</div>';
}

/* 刷新时若焦点在输入框则跳过，避免打字被打断 */
function quietRender() {
  if (state.pair && state.pair.status === 'active' && state.status && state.data && state.slack)
    renderMain();
}

/* ---------------- 认证视图 ---------------- */
function renderAuth() {
  const login = state.authTab === 'login';
  document.getElementById('app').innerHTML = `
  <div class="center-wrap"><div class="card auth-card">
    <div class="brand">
      <div class="logo">💞</div>
      <h1>两个人的小空间</h1>
      <div class="muted">看见彼此的日常，按自己的节奏前进</div>
    </div>
    <div class="tabs">
      <button class="${login ? 'active' : ''}" onclick="setAuthTab('login')">登录</button>
      <button class="${!login ? 'active' : ''}" onclick="setAuthTab('register')">注册</button>
    </div>
    <form onsubmit="submitAuth(event)">
      ${
        login
          ? ''
          : '<label class="field">昵称<input class="input" name="displayName" placeholder="TA 会怎么叫你" required></label>'
      }
      <label class="field">用户名<input class="input" name="username" placeholder="2-20 位" required></label>
      <label class="field">密码<input class="input" type="password" name="password" placeholder="至少 6 位" required></label>
      <button class="btn btn-primary btn-block">${login ? '登录' : '注册并进入'}</button>
    </form>
  </div></div>`;
}
window.setAuthTab = (t) => {
  state.authTab = t;
  render();
};
window.submitAuth = async (e) => {
  e.preventDefault();
  const o = Object.fromEntries(new FormData(e.target));
  try {
    const r =
      state.authTab === 'login'
        ? await api('POST', '/auth/login', { username: o.username, password: o.password })
        : await api('POST', '/auth/register', {
            username: o.username,
            password: o.password,
            displayName: o.displayName,
          });
    state.token = r.token;
    state.me = r.user;
    localStorage.setItem('cc_token', r.token);
    state.pair = await api('GET', '/pair');
    if (state.pair.status === 'active') {
      await refreshAll();
      render();
      startPolling();
    } else if (state.pair.status === 'waiting') {
      render();
      startPairPolling();
    } else {
      render();
    }
  } catch (err) {
    toast(err.message);
  }
};

/* ---------------- 配对视图 ---------------- */
function renderPair() {
  const s = state.pair ? state.pair.status : 'none';
  let body;
  if (s === 'waiting') {
    body = `
      <div class="brand"><div class="logo">⏳</div><h1>等待 TA 加入</h1></div>
      <div class="pair-code">${state.pair.code}</div>
      <p class="muted" style="text-align:center;margin-top:12px">
        把这 6 位配对码发给 TA，TA 注册后输入即可绑定
      </p><button class="btn btn-block" onclick="cancelInvitation()">取消邀请 / 输入对方配对码</button>`;
  } else {
    body = `
      <div class="brand"><div class="logo">🔗</div><h1>和 TA 绑定</h1>
        <div class="muted">一个人生成码，另一个人输入</div></div>
      <button class="btn btn-primary btn-block" onclick="genCode()">生成我的配对码</button>
      <div class="divider">或者</div>
      <form onsubmit="joinCode(event)">
        <label class="field">输入 TA 的配对码
          <input class="input" name="code" maxlength="6" placeholder="6 位码" required
            style="text-transform:uppercase;letter-spacing:3px"></label>
        <button class="btn btn-block">绑定 TA</button>
      </form>`;
  }
  document.getElementById('app').innerHTML =
    `<div class="center-wrap"><div class="card auth-card">${body}</div></div>`;
}
window.genCode = async () => {
  try {
    const r = await api('POST', '/pair/code');
    state.pair = { status: 'waiting', code: r.code };
    render();
    startPairPolling();
    toast('配对码已生成，发给 TA 吧');
  } catch (e) {
    toast(e.message);
  }
};
window.joinCode = async (e) => {
  e.preventDefault();
  try {
    state.pair = await api('POST', '/pair/join', { code: e.target.code.value });
    await refreshAll();
    render();
    startPolling();
    toast('配对成功，开始一起打卡吧');
  } catch (err) {
    toast(err.message);
  }
};

/* ---------------- 主视图 ---------------- */
function personCard(which) {
  const st = state.status[which];
  const isMe = which === 'mine';
  return `
  <div class="card person">
    <div class="avatar ${isMe ? '' : 'partner'}">
      ${esc((st.user.displayName || '?')[0])}<span class="dot ${st.online ? 'online' : ''}"></span>
    </div>
    <div class="meta">
      <div class="name">${esc(st.user.displayName)} ${isMe ? '<span class="muted">(我)</span>' : ''}</div>
      <div class="current-activity">${esc(st.custom_activity || ACT_MAP[st.activity] || '尚未分享')}</div>
      <div class="badges">
        <span class="badge">${MOOD_MAP[st.mood] || st.mood}</span>
        <span class="badge ${st.focus === 'slacking' ? 'slacking' : st.focus === 'focusing' ? 'focusing' : ''}">
          ${FOCUS_MAP[st.focus] || st.focus}
        </span>

      </div>
      <div class="muted" style="margin-top:5px;font-size:11.5px">
        ${relativeStatusTime(st.updated_at)} · ${st.online ? '最近使用过应用' : '上次活跃 ' + relTime(st.last_active_at)}
        ${Date.now() - Date.parse(st.updated_at) > 7200000 ? ' · 状态可能已变化' : ''}
      </div>
      ${!isMe && st.focus === 'slacking'
        ? '<button class="btn btn-sm catch-btn" onclick="catchSlack()">🐟 抓包！</button>'
        : ''}
    </div>
  </div>`;
}

function seg(label, key, map, current) {
  const buttons = Object.entries(map)
    .map(
      ([v, t]) =>
        `<button class="${current === v ? 'on' : ''}" onclick="setStatus('${key}','${v}')">${t}</button>`
    )
    .join('');
  return `<div class="seg-group"><div class="seg-label">${label}</div><div class="seg">${buttons}</div></div>`;
}
function myStatusEditor() {
  const st = state.status.mine;
  return `<div class="card"><h2>我正在做什么 <button class="btn btn-sm btn-ghost" onclick="takeBreak()">休息一下</button></h2>
    <form class="add-row" onsubmit="shareActivity(event)"><input class="input" name="currentActivity" maxlength="100" placeholder="比如：复习时间序列第三章" required><button class="btn btn-primary">分享</button></form>
    <details id="status-options"><summary>快捷状态与心情</summary>
    ${seg('心情', 'mood', MOOD_MAP, st.mood)}
    ${seg('专注', 'focus', FOCUS_MAP, st.focus)}
    ${seg('正在做', 'activity', ACT_MAP, st.activity)}
    </details>
  </div>`;
}
window.setStatus = async (key, val) => {
  try {
    const r = await api('PUT', '/status', { [key]: val, ...(key === 'activity' ? { customActivity: '' } : {}) });
    state.status.mine = Object.assign({}, state.status.mine, r.status);
    render();
  } catch (e) {
    toast(e.message);
  }
};

function reviewItem(r) {
  const name = state.data.users.partner.displayName;
  return `<div class="review-item"><span class="who">${esc(name)}：</span>${
    r.emoji ? EMOJI_MAP[r.emoji].icon + ' ' : ''
  }${r.comment ? esc(r.comment) : ''}</div>`;
}
function myTaskItem(t) {
  return `<li class="task ${t.is_completed ? 'done' : ''}">
    <div class="task-head">
      <span class="check ${t.is_completed ? 'on' : ''}" onclick="toggleTask('${t.id}')">${
    t.is_completed ? '✓' : ''
  }</span>
      <span class="content">${esc(t.content)}</span>
      ${!t.is_completed && state.date === todayStr() ? `<button class="btn btn-sm" onclick="startTask('${t.id}')">开始做</button>` : ''}
      <button class="del" onclick="delTask('${t.id}')" title="删除">🗑️</button>
    </div>
    ${
      t.is_completed && t.completed_at
        ? `<div class="time">完成于 ${clockTime(t.completed_at)}</div>`
        : ''
    }
    ${t.reviews.length ? `<div class="reviews">${t.reviews.map(reviewItem).join('')}</div>` : ''}
  </li>`;
}
function partnerTaskItem(t) {
  const myReview = (t.reviews || []).find((r) => r.reviewer_id === state.me.id);
  return `<li class="task ${t.is_completed ? 'done' : ''}">
    <div class="task-head">
      <span class="check ${t.is_completed ? 'on' : ''}">${t.is_completed ? '✓' : ''}</span>
      <span class="content">${esc(t.content)}</span>
      ${t.is_completed ? '<span title="已完成">✅</span>' : ''}
    </div>
    <div class="time" style="${t.is_completed ? '' : 'color:#b06d00'}">
      ${t.is_completed && t.completed_at ? '完成于 ' + clockTime(t.completed_at) : '还没完成'}
    </div>
    <div class="emoji-row">
      ${Object.entries(EMOJI_MAP)
        .map(
          ([k, v]) =>
            `<button class="emoji-btn ${
              myReview && myReview.emoji === k ? 'on' : ''
            }" title="${v.label}" onclick="pickEmoji('${t.id}','${k}')">${v.icon}</button>`
        )
        .join('')}
    </div>
    <form class="comment-row" onsubmit="sendComment(event,'${t.id}')">
      <input name="comment" maxlength="300" placeholder="留句话…"
        value="${myReview && myReview.comment ? esc(myReview.comment) : ''}">
      <button class="btn btn-sm btn-primary">发送</button>
    </form>
  </li>`;
}

function myTasksCard() {
  const d = state.data;
  const id = d.users.me.id;
  const p = d.progress[id];
  const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
  const tasks = d.tasks.filter((t) => t.owner_id === id);
  return `<div class="card"><h2>✅ 我今天的任务 <span class="muted">${p.done}/${p.total}</span></h2>
    <div class="progress"><span style="width:${pct}%"></span></div>
    <form class="add-row" onsubmit="addTask(event)">
      <input class="input" name="content" placeholder="给自己加一个任务…" maxlength="500" required>
      <button class="btn btn-primary">添加</button>
    </form>
    <ul class="task-list">
      ${tasks.length ? tasks.map(myTaskItem).join('') : '<li class="muted">还没有任务，先定一个吧～</li>'}
    </ul>
  </div>`;
}
function partnerTasksCard() {
  const d = state.data;
  const id = d.users.partner.id;
  const p = d.progress[id];
  const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
  const tasks = d.tasks.filter((t) => t.owner_id === id);
  return `<div class="card"><h2>👀 TA 今天的任务 <span class="muted">${p.done}/${p.total}</span></h2>
    <div class="progress"><span style="width:${pct}%"></span></div>
    <ul class="task-list">
      ${tasks.length ? tasks.map(partnerTaskItem).join('') : '<li class="muted">TA 还没有定任务</li>'}
    </ul>
  </div>`;
}

window.addTask = async (e) => {
  e.preventDefault();
  const content = e.target.content.value;
  try {
    await api('POST', '/tasks', { content, date: state.date });
    e.target.reset();
    await loadTasks();
    render();
  } catch (err) {
    toast(err.message);
  }
};
window.toggleTask = async (id) => {
  const t = state.data.tasks.find((x) => x.id === id);
  try {
    await api('PATCH', '/tasks/' + id, { isCompleted: !t.is_completed });
    await refreshAll();
    quietRender();
  } catch (e) {
    toast(e.message);
  }
};
window.delTask = async (id) => {
  try {
    await api('DELETE', '/tasks/' + id);
    await loadTasks();
    render();
  } catch (e) {
    toast(e.message);
  }
};
window.pickEmoji = async (taskId, k) => {
  const t = state.data.tasks.find((x) => x.id === taskId);
  const old = (t.reviews || []).find((r) => r.reviewer_id === state.me.id);
  if (old && old.emoji === k) return;
  try {
    await api('PUT', '/reviews', {
      taskId,
      emoji: k,
      comment: old ? old.comment : undefined,
    });
    await loadTasks();
    quietRender();
  } catch (e) {
    toast(e.message);
  }
};
window.sendComment = async (e, taskId) => {
  e.preventDefault();
  const comment = e.target.comment.value;
  try {
    const t = state.data.tasks.find((x) => x.id === taskId);
    const old = (t.reviews || []).find((r) => r.reviewer_id === state.me.id);
    await api('PUT', '/reviews', { taskId, comment, emoji: old ? old.emoji : undefined });
    await loadTasks();
    render();
    toast('已回应');
  } catch (err) {
    toast(err.message);
  }
};

/* ---------------- 摸鱼卡 ---------------- */
function slackControlCard() {
  const myId = state.data.users.me.id;
  const pid = state.data.users.partner.id;
  const slacking = state.status.mine.focus === 'slacking';
  const partnerSlacking = state.status.theirs.focus === 'slacking';
  const stats = state.slack.stats;
  return `<div class="card"><h2>🐟 摸鱼 &amp; 抓包</h2>
    ${
      slacking
        ? `<div class="badge slacking" style="font-size:14px">🐟 你正在摸鱼，小心！</div>
           <button class="btn btn-block" style="margin-top:10px" onclick="setStatus('focus','available')">回去认真 ✍️</button>`
        : `<button class="btn btn-block" onclick="setStatus('focus','slacking')">偷偷摸个鱼 🐟</button>`
    }
    ${
      partnerSlacking
        ? '<button class="btn btn-block catch-btn" style="margin-top:10px" onclick="catchSlack()">TA 在摸鱼！立刻抓包 🚨</button>'
        : '<div class="muted" style="margin-top:10px">TA 现在很乖，没有摸鱼</div>'
    }
    <div class="slack-stats">
      <div class="stat-box"><div class="num">${stats[myId] || 0}</div><div class="muted">我被抓</div></div>
      <div class="stat-box"><div class="num">${stats[pid] || 0}</div><div class="muted">TA 被抓</div></div>
    </div>
  </div>`;
}
function slackHistoryCard() {
  const h = state.slack.history || [];
  const myId = state.data.users.me.id;
  const pname = state.data.users.partner.displayName;
  return `<div class="card"><h2>📒 抓包记录</h2>
    <ul class="history-list">
      ${
        h.length
          ? h
              .map((c) => {
                const caughtMe = c.caught_id === myId;
                return `<li>${caughtMe ? '你' : esc(pname)}摸鱼被${
                  caughtMe ? esc(pname) : '你'
                }抓了 · ${relTime(c.created_at)}</li>`;
              })
              .join('')
          : '<li class="muted">还没有人被抓过</li>'
      }
    </ul>
  </div>`;
}
window.catchSlack = async () => {
  try {
    const r = await api('POST', '/slack/catch', {
      caughtId: state.data.users.partner.id,
    });
    toast(r.message);
    await refreshAll();
    render();
  } catch (e) {
    toast(e.message);
  }
};

/* ---------------- 主视图组装 ---------------- */
function renderMain() {
  renderPreservingDrafts(document.getElementById('app'), renderMainContent);
}
function renderMainContent() {
  const isToday = state.date === todayStr();
  document.getElementById('app').innerHTML = `
  ${state.syncError ? '<div class="sync-warning" role="status">暂时无法同步 · 当前显示上次内容 <button class="btn btn-sm" onclick="retrySync()">重试</button></div>' : ''}
  <div class="topbar">
    <div class="title">💞 两个人的打卡</div>
    <div class="date-nav">
      <button class="btn btn-sm" onclick="changeDate(-1)">‹</button>
      <div class="date-label">${friendlyDate(state.date)}${isToday ? ' · 今天' : ''}</div>
      <button class="btn btn-sm" onclick="changeDate(1)" ${isToday ? 'disabled' : ''}>›</button>
    </div>
    <div>
      <button class="btn btn-sm" id="installBtn" style="display:none" onclick="installApp()">📥 安装到桌面</button>
      <button class="btn btn-sm btn-ghost" onclick="logout()">退出</button>
    </div>
  </div>
  <div class="people">${personCard('theirs')}${personCard('mine')}</div>
  <div style="margin-top:14px">${myStatusEditor()}</div>
  <details id="daily-tasks" class="card"><summary>今日计划与回应 · ${state.data.tasks.filter(t => t.is_completed).length}/${state.data.tasks.length} 已完成</summary>
    <p class="muted">${isToday ? '今天的计划' : friendlyDate(state.date) + ' 的历史计划'} · 上方状态始终显示最近分享的内容</p>
    <div class="main-grid" style="margin-top:14px">${myTasksCard()}${partnerTasksCard()}</div>
  </details>
  <details id="small-interactions" class="card"><summary>一起休息 · 小互动</summary><div class="slack-grid">${slackControlCard()}${slackHistoryCard()}</div></details>
  <details id="companion-settings" class="card"><summary>伙伴设置</summary><p class="muted">一次与一位伙伴共享日常。解除后停止共享，历史任务不会展示给新伙伴。</p><button class="btn btn-ghost" onclick="unbindPartner()">解除当前绑定</button></details>`;
  if (state.deferredPrompt) {
    const b = document.getElementById('installBtn');
    if (b) b.style.display = '';
  }
}
window.retrySync = async () => {
  try { await refreshAll(); state.syncError = false; render(); } catch (e) { toast('暂时无法同步，请检查网络后重试'); }
};
window.startTask = async (id) => {
  const task = state.data.tasks.find(t => t.id === id && t.owner_id === state.me.id && !t.is_completed);
  if (!task || state.date !== todayStr()) return;
  try { await api('PUT', '/status', { activity: 'idle', customActivity: task.content.slice(0, 100), focus: 'focusing' }); await loadStatus(); render(); toast('已分享：正在做这件事'); } catch (e) { toast(e.message); }
};
window.takeBreak = async () => {
  try { await api('PUT', '/status', { activity: 'idle', customActivity: '休息一下', focus: 'available' }); await loadStatus(); render(); } catch (e) { toast(e.message); }
};
window.shareActivity = async (e) => {
  e.preventDefault();
  try {
    await api('PUT', '/status', { customActivity: e.target.currentActivity.value });
    e.target.reset(); await loadStatus(); render(); toast('已分享当前状态');
  } catch (err) { toast(err.message); }
};
window.cancelInvitation = async () => {
  try { await api('DELETE', '/pair'); clearInterval(pairTimer); state.pair = { status: 'none' }; render(); } catch (e) { toast(e.message); }
};
window.unbindPartner = async () => {
  if (!confirm('解除后双方停止共享状态和任务。历史记录保留且不向新伙伴展示。确定解除？')) return;
  try { await api('DELETE', '/pair'); clearInterval(pollTimer); state.pair = { status: 'none' }; state.data = null; state.status = null; state.slack = null; document.getElementById('app').innerHTML = ''; render(); } catch (e) { toast(e.message); }
};
window.changeDate = (d) => {
  const next = shiftDate(state.date, d);
  if (next > todayStr()) return;
  state.date = next;
  loadTasks()
    .then(render)
    .catch((e) => toast(e.message));
};
window.logout = () => {
  state.token = null;
  state.me = null;
  state.pair = null;
  state.data = null;
  state.status = null;
  state.slack = null;
  localStorage.removeItem('cc_token');
  clearInterval(pollTimer);
  clearInterval(pairTimer);
  render();
};

/* ---------------- 轮询 ---------------- */
let pollTimer = null;
let pairTimer = null;
function startPolling() {
  clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    if (document.visibilityState !== 'visible' || state.refreshing) return;
    state.refreshing = true;
    try {
      await refreshAll();
      state.syncError = false;
      quietRender();
    } catch (e) {
      if (e.status === 401) window.logout();
      else { state.syncError = true; quietRender(); }
    } finally { state.refreshing = false; }
  }, 6000);
}
function startPairPolling() {
  clearInterval(pairTimer);
  pairTimer = setInterval(async () => {
    try {
      state.pair = await api('GET', '/pair');
      if (state.pair.status === 'active') {
        clearInterval(pairTimer);
        await refreshAll();
        render();
        startPolling();
        toast('TA 加入了，配对成功！');
      }
    } catch (e) {}
  }, 4000);
}

/* ---------------- PWA ---------------- */
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  state.deferredPrompt = e;
  const b = document.getElementById('installBtn');
  if (b) b.style.display = '';
});
window.installApp = async () => {
  if (!state.deferredPrompt) {
    toast('也可用浏览器右上角菜单 →「安装此应用」');
    return;
  }
  state.deferredPrompt.prompt();
  await state.deferredPrompt.userChoice;
  state.deferredPrompt = null;
  const b = document.getElementById('installBtn');
  if (b) b.style.display = 'none';
};
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () =>
    navigator.serviceWorker.register('sw.js').catch(() => {})
  );
}

/* ---------------- 启动 ---------------- */
async function bootstrap() {
  if (state.token) {
    try {
      await loadMe();
      state.pair = await api('GET', '/pair');
      if (state.pair.status === 'active') {
        await refreshAll();
        startPolling();
      } else if (state.pair.status === 'waiting') {
        startPairPolling();
      }
    } catch (e) {
      if (e.status === 401) window.logout();
      else toast(e.message);
    }
  }
  render();
}
bootstrap();
