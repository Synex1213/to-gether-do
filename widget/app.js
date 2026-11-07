'use strict';

const content = document.getElementById('content');
const toastEl = document.getElementById('toast');
const IS_NATIVE = Boolean(window.widget);
const THEME_OPTIONS = [ ['blue', '莫兰迪蓝', '#8da6b8'], ['purple', '莫兰迪紫', '#aa9bb8'], ['green', '莫兰迪绿', '#88a294'], ['yellow', '莫兰迪黄', '#c2b085'], ['pink', '莫兰迪粉', '#c19daa'], ['black', '标准黑', '#29313e'], ['white', '标准白', '#ffffff'] ];
const bridge = window.widget || {
  getConfig: async () => { try { return JSON.parse(localStorage.getItem('companion_config')) || {}; } catch (_) { return {}; } },
  setConfig: async patch => { const config = { ...state.config, ...patch }; localStorage.setItem('companion_config', JSON.stringify(config)); return config; },
  setMode: async () => true,
};
let windowMode = '';
const DURATIONS = [[0, '不限时间'], [30, '30 分钟'], [60, '1 小时'], [120, '2 小时']];
let welcomeShown = false;
let statusSaving = false;
let authSaving = false;
let taskSaving = false;
let statusExpiryTimer;
let refreshTimer;
let failures = 0;
let nextRetryAfter = 0;
let sessionGeneration = 0;


const state = {
  config: null,
  refreshing: false,
  token: localStorage.getItem('token') || localStorage.getItem('cc_token') || '',
  date: today(),
  panel: 'status',
  statusDraft: '',
  taskDraft: '',
  refreshQueued: false,
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
  reviewDrafts: {},
  syncError: false,
  reviewEmoji: 'cheer',
};

const EMOJI = { cheer: '💪', hug: '🤗', knock: '👏', kiss: '✨' };
const MOODS = [
  { k: 'normal', label: '😐 平常' },
  { k: 'happy', label: '😊 开心' },
  { k: 'tired', label: '😴 有点累' },
  { k: 'missyou', label: '🙂 想聊聊' },
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
  return CompanionConnection.requestJson(base + path, { ...opts, headers });
}

async function loadConfig() {
  state.config = { apiBase: IS_NATIVE ? 'https://to-gether-do-2.onrender.com' : location.origin, compact: true, theme: 'green', alwaysOnTop: true, autoLaunch: false, snapToEdge: true, positionLocked: false, onboardingSeen: false, statusDurationMinutes: 0, recentActivities: [], ...await bridge.getConfig() };
  if (!THEME_OPTIONS.some(([key]) => key === state.config.theme)) state.config.theme = 'green';
  if (!DURATIONS.some(([minutes]) => minutes === state.config.statusDurationMinutes)) state.config.statusDurationMinutes = 0;
  state.config.recentActivities = Array.isArray(state.config.recentActivities) ? state.config.recentActivities.filter(key => ACTIVITY.some(a => a.k === key)).slice(0,3) : [];
  applyChrome();
}
async function saveConfig(patch) {
  state.config = { ...state.config, ...await bridge.setConfig(patch) };
  applyChrome();
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
function applyChrome() {
  if (!state.config) return;
  document.documentElement.dataset.theme = state.config.theme;
  document.body.classList.toggle('web-host', !IS_NATIVE);
  document.body.classList.toggle('position-locked', IS_NATIVE && state.config.positionLocked);
  const connection = document.getElementById('connection-state');
  connection.hidden = !state.syncError;
  connection.title = state.syncMessage || '同步暂不可用，会自动重试';
  const compact = state.phase === 'main' && state.config.compact !== false;
  const mode = ['main','loading'].includes(state.phase) ? (state.config.compact !== false ? 'compact' : 'expanded') : 'auth';
  document.body.classList.toggle('is-compact', compact);
  document.body.classList.toggle('is-auth', mode === 'auth');
  const modeButton = document.getElementById('btn-mode');
  modeButton.textContent = compact ? '展开' : '收起';
  modeButton.disabled = state.phase !== 'main';
  modeButton.hidden = state.phase !== 'main';
  modeButton.setAttribute('aria-expanded', String(!compact));
  modeButton.title = compact ? '展开状态、计划与互动' : '收起为双方近况小窗';
  const pin = document.getElementById('btn-pin');
  pin.setAttribute('aria-pressed', String(state.config.alwaysOnTop !== false));
  pin.title = state.config.alwaysOnTop !== false ? '取消置顶' : '置顶到其他窗口上方';
  const pinSetting = document.getElementById('setting-pin');
  if (pinSetting) pinSetting.checked = state.config.alwaysOnTop !== false;
  const launchSetting = document.getElementById('setting-autolaunch');
  if (launchSetting) launchSetting.checked = Boolean(state.config.autoLaunch);
  for (const [id,key] of [['setting-lock','positionLocked'],['setting-snap','snapToEdge']]) {
    const setting = document.getElementById(id);
    if (setting) setting.checked = Boolean(state.config[key]);
  }
  const durationSetting = document.getElementById('setting-duration');
  if (durationSetting) durationSetting.value = String(state.config.statusDurationMinutes);
  if (state.phase !== 'main') {
    document.getElementById('quick-status').hidden = true;
    document.getElementById('onboarding').hidden = true;
  }
  const date = document.getElementById('plan-date');
  if (document.activeElement !== date) date.value = state.date;
  date.max = today(); date.disabled = state.phase !== 'main';
  const themes = document.getElementById('themes');
  if (!themes.childElementCount) themes.innerHTML = THEME_OPTIONS.map(([key, name, color]) => `<button class="theme-dot" data-theme="${key}" style="--swatch:${color}" title="${name}" aria-label="${name}" aria-pressed="${state.config.theme === key}"></button>`).join('');
  for (const button of themes.children) button.setAttribute('aria-pressed', String(button.dataset.theme === state.config.theme));
  if (windowMode !== mode) { windowMode = mode; void bridge.setMode?.(mode); }
}
async function openPanel(panel) {
  state.panel = panel;
  if (state.config.compact !== false) await saveConfig({ compact: false });
  render();
}
function render() {
  clearTimeout(statusExpiryTimer);
  if (state.token && !state.me && state.config?.apiBase) {
    state.phase = 'loading';
    applyChrome();
    content.innerHTML = `<div class="card" role="status"><strong>${state.syncError ? '连接暂不可用' : '正在连接伙伴空间…'}</strong><p class="muted">${state.syncError ? escapeHtml(state.syncMessage || '正在自动重试，账号无需重新注册。') : '首次连接可能需要稍等片刻。'}</p><button class="btn btn-block" id="sync-retry">重试连接</button><button class="btn btn-ghost btn-block" id="logout">退出登录</button></div>`;
    return;
  }
  if (!state.config || !state.config.apiBase) state.phase = 'setup';
  else if (!state.token) state.phase = 'auth';
  else if (!state.pairInfo || state.pairInfo.status !== 'active') state.phase = 'pair';
  else state.phase = 'main';

  applyChrome();
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
      <div class="auth-intro"><img src="${IS_NATIVE ? 'icon.png' : '/widget/icon.png'}" alt=""><h1>伙伴打卡</h1><p>各自做事，偶尔看一眼。</p></div>
      <div class="tabs">
        <button class="tab ${state.authTab === 'login' ? 'active' : ''}" data-tab="login">登录</button>
        <button class="tab ${state.authTab === 'register' ? 'active' : ''}" data-tab="register">注册</button>
      </div>
      <div class="field"><label class="label" for="auth-username">用户名</label><input class="input" id="auth-username" autocomplete="username" maxlength="20" placeholder="2–20 位中英文、数字或下划线"></div>
      <div class="field"><label class="label" for="auth-password">密码</label><input class="input" id="auth-password" type="password" autocomplete="${state.authTab === 'register' ? 'new-password' : 'current-password'}" placeholder="至少 6 位"></div>
      ${state.authTab === 'register' ? '<div class="field"><label class="label" for="auth-display">昵称</label><input class="input" id="auth-display" maxlength="24" autocomplete="nickname" placeholder="伙伴看到的名字"></div>' : ''}
      <button class="btn btn-block" id="auth-submit">${state.authTab === 'login' ? '登录' : '注册'}</button>
    </div>
  `;
}

function renderPair() {
  const waiting = state.pairInfo && ['waiting', 'pending'].includes(state.pairInfo.status);
  const myCode = waiting ? state.pairInfo.code : null;
  content.innerHTML = `
    <div class="card">
      <div class="card-title">🤝 绑定伙伴</div><p class="muted">一次与一位伙伴共享日常，可以随时解除绑定。</p>
      ${myCode ? `
        <div class="muted text-center">把你的配对码发给 TA</div>
        <div class="pair-code">${myCode}</div>
        <div class="muted text-center mb8">等待 TA 加入…</div>
        <button class="btn btn-ghost btn-block btn-sm" id="pair-refresh">刷新状态</button><button class="btn btn-ghost btn-block btn-sm" id="pair-cancel">取消邀请 / 输入对方配对码</button>
      ` : `
        <button class="btn btn-block mb8" id="pair-create">生成我的配对码</button>
        <div class="muted text-center mb8">—— 或 ——</div>
        <div class="field"><label class="label">输入 TA 的配对码</label>
        <input class="input" id="pair-code-input" placeholder="6 位码" maxlength="6"></div>
        <button class="btn btn-ghost btn-block" id="pair-join">加入</button>
      `}
      <button class="btn btn-ghost btn-block btn-sm" id="logout">退出登录</button>
    </div>
  `;
}

function renderMain() {
  renderPreservingDrafts(content, renderMainContent);
  // Expiry remains accurate while offline; no network request is needed.
  const deadlines = [state.myStatus, state.partnerStatus].flatMap(st => [Date.parse(st?.expires_at), Date.parse(st?.updated_at) + 7200000]).filter(time => Number.isFinite(time) && time > Date.now());
  if (deadlines.length) statusExpiryTimer = setTimeout(() => render(), Math.min(...deadlines) - Date.now() + 30);
  if (!welcomeShown && state.config.onboardingSeen !== true) {
    welcomeShown = true;
    showWelcome();
    void saveConfig({ onboardingSeen: true }).catch(() => {});
  }
}
function statusExpired(st) { return st?.expired === true || Boolean(st?.expires_at && Date.parse(st.expires_at) <= Date.now()); }
function durationOptions(selected) { return DURATIONS.map(([minutes,label]) => `<option value="${minutes}" ${minutes === selected ? 'selected' : ''}>${label}</option>`).join(''); }
function showWelcome() {
  const panel = document.getElementById('onboarding');
  panel.innerHTML = `<div class="overlay-heading">偶尔看一眼就好</div><p class="onboarding-copy">点自己改状态，点伙伴看计划。<br>右键自己，可以快速切换。<br>${IS_NATIVE ? '关闭小窗后，仍可从托盘打开。' : '点展开，可以查看更多。'}</p><button class="btn btn-sm btn-block" id="welcome-dismiss">知道了</button>`;
  panel.hidden = false;
}
function closeQuickStatus(restoreFocus = false) {
  const panel = document.getElementById('quick-status');
  const wasOpen = !panel.hidden;
  panel.hidden = true;
  if (wasOpen && restoreFocus) content.querySelector('[data-person="mine"]')?.focus();
}
function openQuickStatus() {
  if (state.phase !== 'main' || statusSaving) return;
  document.getElementById('onboarding').hidden = true;
  const order = [...new Set([...state.config.recentActivities, 'study','work','eat','idle','sleep','commute'])];
  const panel = document.getElementById('quick-status');
  panel.innerHTML = `<div class="overlay-heading">快速改状态<button class="icon-btn" id="quick-close" aria-label="关闭快速状态">×</button></div><div class="quick-grid">${order.map(key => `<button class="btn btn-ghost" data-quick-activity="${key}">${key === 'idle' ? '休息' : labelOf(ACTIVITY,key)}</button>`).join('')}</div><label class="duration-row">本次有效期<select id="quick-duration" aria-label="本次状态有效期">${durationOptions(state.config.statusDurationMinutes)}</select></label>`;
  panel.hidden = false;
  panel.querySelector('[data-quick-activity]')?.focus();
}
async function shareStatus(patch, minutes = state.config.statusDurationMinutes) {
  if (statusSaving) throw new Error('正在更新状态，请稍候');
  statusSaving = true;
  try {
    const isActivity = ['activity','focus','customActivity'].some(key => Object.hasOwn(patch,key));
    await api('/api/status', { method:'PUT', body:JSON.stringify({ ...patch, ...(isActivity ? { durationMinutes: minutes } : {}) }) });
    if (patch.activity) {
      const recentActivities = [...new Set([patch.activity, ...state.config.recentActivities])].slice(0,3);
      try { await saveConfig({ recentActivities }); } catch (_) { state.config.recentActivities = recentActivities; }
    }
    return true;
  } finally { statusSaving = false; }
}
function glancePerson(isMine) {
  const st = (isMine ? state.myStatus : state.partnerStatus) || {};
  const name = isMine ? state.me.displayName : state.partner.displayName;
  const activity = st.custom_activity || labelOf(ACTIVITY, st.activity) || '尚未分享';
  const expired = statusExpired(st);
  const stale = expired || !Number.isFinite(Date.parse(st.updated_at)) || Date.now() - Date.parse(st.updated_at) > 7200000;
  const focus = labelOf(FOCUS, st.focus) || '可打扰';
  const time = expired ? '已到期' : relativeStatusTime(st.updated_at).replace('更新', '');
  return `<button class="glance-person ${stale ? 'is-stale' : ''}" data-person="${isMine ? 'mine' : 'partner'}" data-open-panel="${isMine ? 'status' : 'tasks'}" aria-label="${escapeHtml(name)}${isMine ? '（我）' : ''}的状态" title="${escapeHtml(name)} · ${escapeHtml(activity)} · ${expired ? '有效期已结束，待更新' : escapeHtml(focus)} · ${relativeStatusTime(st.updated_at)}${stale ? '（上次分享，可能已变化）' : ''}${isMine ? '；右键快速改状态' : ''}">
    <span class="person-avatar" aria-hidden="true">${escapeHtml((name || '?')[0])}</span>
    <span class="person-summary"><span class="person-top"><span class="person-name">${escapeHtml(name)}${isMine ? ' · 我' : ''}</span><span class="online-dot ${st.online && !state.syncError ? 'online' : ''}" title="最近是否使用应用"></span><span class="person-time">${time}</span></span><span class="person-activity-row"><span class="current-activity">${expired ? '待更新 · ' : stale ? '上次 · ' : ''}${escapeHtml(activity)}</span><span class="person-focus">${stale ? '' : escapeHtml(focus)}</span></span></span>
  </button>`;
}
function renderMainContent() {
  const mine = state.myStatus || {};
  const theirs = state.partnerStatus || {};
  const myTasks = state.tasks.filter(t => t.owner_id === state.me.id);
  const partnerTasks = state.tasks.filter(t => t.owner_id === state.partner.id);
  const isToday = state.date === today();
  const expanded = state.config.compact === false;
  content.innerHTML = `
    ${state.syncError && expanded ? '<div class="sync-warning" role="status">同步暂不可用 · 显示上次近况 <button class="btn btn-sm btn-ghost" id="sync-retry">重试</button></div>' : ''}
    <div class="glance-list">${glancePerson(false)}${glancePerson(true)}</div>
    ${expanded ? `
    <nav class="panel-tabs" aria-label="小窗详情">${[['status','状态'],['tasks','计划'],['play','互动'],['settings','设置']].map(([key,label]) => `<button data-panel="${key}" class="${state.panel === key ? 'active' : ''}" aria-pressed="${state.panel === key}">${label}</button>`).join('')}</nav>
    <section class="card" ${state.panel === 'status' ? '' : 'hidden'} aria-label="更新我的状态">
      <div class="card-title">我的状态 <button class="btn btn-sm btn-ghost" id="take-break">休息一下</button></div>
      <div class="task-add"><label class="sr-only" for="current-activity">当前事项</label><input class="input" id="current-activity" maxlength="100" value="${escapeHtml(state.statusDraft)}" placeholder="此刻在做什么…"><button class="btn" id="activity-save">分享</button></div>
      <div class="status-row">${FOCUS.map(f => `<button class="chip ${mine.focus === f.k ? 'active' : ''}" data-set-focus="${f.k}">${f.label}</button>`).join('')}</div>
      <div class="status-row">${ACTIVITY.map(a => `<button class="chip ${mine.activity === a.k ? 'active' : ''}" data-set-activity="${a.k}">${a.label}</button>`).join('')}</div>
      <div class="status-row">${MOODS.map(m => `<button class="chip ${mine.mood === m.k ? 'active' : ''}" data-set-mood="${m.k}">${m.label}</button>`).join('')}</div>
    </section>
    <section id="daily-tasks" ${state.panel === 'tasks' ? '' : 'hidden'} aria-label="双方计划">
      <div class="card"><div class="card-title">${isToday ? '今天' : escapeHtml(state.date)}的计划 <span class="muted">用底部日历选日期</span></div>${!isToday ? '<p class="muted">回看历史计划；上方仍是最近分享的状态。</p>' : ''}
      <div class="card-title">我 · ${myTasks.filter(t=>t.is_completed).length}/${myTasks.length}</div>
      <div class="task-add"><label class="sr-only" for="task-input">添加任务</label><input class="input" maxlength="500" id="task-input" value="${escapeHtml(state.taskDraft)}" placeholder="给自己加一件事…" ${isToday ? '' : 'disabled'}><button class="btn" id="task-add" ${isToday ? '' : 'disabled'}>添加</button></div>
      ${myTasks.length ? myTasks.map(renderTaskItem).join('') : '<div class="empty">没有计划也没关系，按自己的节奏来。</div>'}</div>
      <div class="card"><div class="card-title">伙伴 · ${partnerTasks.filter(t=>t.is_completed).length}/${partnerTasks.length}</div>${partnerTasks.length ? partnerTasks.map(renderTaskItem).join('') : '<div class="empty">伙伴还没有添加计划</div>'}</div>
    </section>
    <section class="card" ${state.panel === 'play' ? '' : 'hidden'} aria-label="轻松互动">
      <div class="card-title">摸鱼与抓包</div><div class="slack-row"><button class="btn btn-ghost" id="${mine.focus === 'slacking' && !statusExpired(mine) ? 'slack-stop' : 'slack-start'}">${mine.focus === 'slacking' && !statusExpired(mine) ? '结束摸鱼' : '摸个鱼 🐟'}</button><button class="btn btn-ghost" id="slack-catch" ${!statusExpired(theirs) && theirs.focus === 'slacking' && Date.now()-Date.parse(theirs.updated_at) <= 7200000 ? '' : 'disabled'}>抓个正着</button></div>
      <div class="slack-stats"><div><div class="slack-num">${state.slackStats[state.me.id] || 0}</div>我被抓</div><div><div class="slack-num">${state.slackStats[state.partner.id] || 0}</div>伙伴被抓</div></div>
    </section>
    <section class="card" ${state.panel === 'settings' ? '' : 'hidden'} aria-label="小窗设置">
      ${IS_NATIVE ? `<label class="setting-row">始终置顶<input type="checkbox" id="setting-pin" ${state.config.alwaysOnTop !== false ? 'checked' : ''}></label><label class="setting-row">开机自启<input type="checkbox" id="setting-autolaunch" ${state.config.autoLaunch ? 'checked' : ''}></label>` : '<p class="muted">桌面版支持置顶、托盘隐藏与开机自启。</p>'}
      ${IS_NATIVE ? `<label class="setting-row">靠近边缘自动吸附<input type="checkbox" id="setting-snap" ${state.config.snapToEdge ? 'checked' : ''}></label><label class="setting-row">锁定窗口位置<input type="checkbox" id="setting-lock" ${state.config.positionLocked ? 'checked' : ''}></label>` : ''}
      <label class="setting-row">默认状态有效期<select id="setting-duration">${durationOptions(state.config.statusDurationMinutes)}</select></label>
      <p class="muted">有效期用于之后分享的状态；到期显示待更新。右键自己的状态卡可临时选择本次时长。</p>
      <button class="btn btn-sm btn-ghost" id="show-help">操作提示</button>
      <p class="muted">底部七颗色点可换主题。一次与一位伙伴共享近况，可随时解除绑定。</p>
      <button class="btn btn-ghost btn-block" id="pair-unbind">解除当前绑定</button><button class="btn btn-ghost btn-block" id="logout">退出登录</button>
    </section>` : ''}
  `;
}

function renderTaskItem(t) {
  const isMine = t.owner_id === state.me.id;
  const editable = isMine && state.date === today();
  const review = (t.reviews && t.reviews[0]) || null;
  const open = state.reviewOpenTaskId === t.id;
  const draft = state.reviewDrafts[t.id];
  return `
    <div class="task-item">
      ${editable ? `<button class="task-check ${t.is_completed ? 'done' : ''}" data-toggle="${t.id}" aria-label="${t.is_completed ? '取消完成' : '完成任务'}"></button>` : `<span class="task-check ${t.is_completed ? 'done' : ''}" aria-label="${t.is_completed ? '已完成' : '未完成'}"></span>`}
      <div class="task-body">
        <div class="task-text ${t.is_completed ? 'done' : ''}">${escapeHtml(t.content)}</div>
        ${t.completed_at ? `<div class="task-meta">完成于 ${fmtTime(t.completed_at)}</div>` : ''}
        ${review ? `<div class="review-box"><span class="review-emoji">${EMOJI[review.emoji] || ''}</span>${escapeHtml(review.comment || '')}</div>` : ''}
        ${open ? `
          <div class="review-editor">
            <div class="review-emojis">
              ${Object.entries(EMOJI).map(([k, v]) => `<button class="review-emoji-btn ${state.reviewEmoji === k ? 'active' : ''}" data-emoji="${k}">${v}</button>`).join('')}
            </div>
            <input class="input" maxlength="300" id="review-comment" data-draft-key="review:${t.id}" placeholder="留一句话…" value="${escapeHtml(draft ? draft.comment : review?.comment || '')}">
            <div class="mt8" style="display:flex;gap:6px">
              <button class="btn btn-sm" data-review-submit="${t.id}">提交回应</button>
              <button class="btn btn-ghost btn-sm" data-review-cancel>取消</button>
            </div>
          </div>
        ` : ''}
      </div>
      <div class="task-actions">
        ${!isMine ? `<button class="icon-btn" title="回应" data-review-open="${t.id}">✏️</button>` : ''}
        ${editable && !t.is_completed ? `<button class="btn btn-ghost btn-sm" data-start-task="${t.id}">开始做</button>` : ''}
        ${editable ? `<button class="icon-btn" title="删除" data-task-del="${t.id}">🗑</button>` : ''}
      </div>
    </div>
  `;
}

// ===== 数据加载 =====
async function refreshAll() {
  if (state.refreshing) { state.refreshQueued = true; return; }
  clearTimeout(refreshTimer);
  state.refreshing = true;
  const generation = sessionGeneration;
  const requestedDate = state.date;
  try {
    const meRes = await api('/api/auth/me');
    const pairRes = await api('/api/pair/');
    if (generation !== sessionGeneration) return;
    if (state.pairInfo?.pairId !== pairRes.pairId) { state.tasks = []; state.myStatus = null; state.partnerStatus = null; state.slackStats = {}; content.innerHTML = ''; state.reviewDrafts = {}; state.reviewOpenTaskId = null; state.statusDraft = ''; state.taskDraft = ''; }
    state.me = meRes.user;
    state.pairInfo = pairRes;
    state.partner = pairRes.partner || null;
    if (pairRes.status === 'active') {
      const [tasksRes, statusRes, slackRes] = await Promise.all([
        api('/api/tasks?date=' + requestedDate), api('/api/status'), api('/api/slack/stats'),
      ]);
      if (generation !== sessionGeneration) return;
      if (requestedDate === state.date) state.tasks = tasksRes.tasks || [];
      state.myStatus = statusRes.mine;
      state.partnerStatus = statusRes.theirs;
      state.slackStats = slackRes.stats || {};
    } else { state.tasks = []; state.myStatus = null; state.partnerStatus = null; }
    state.syncError = false; failures = 0; nextRetryAfter = 0;
    render();
  } catch (e) {
    if (generation !== sessionGeneration) return;
    failures++; nextRetryAfter = e.retryAfter || 0; state.syncMessage = e.message;
    if (e.status === 401) { state.token = ''; localStorage.removeItem('token'); localStorage.removeItem('cc_token'); state.pairInfo = null; render(); }
    else { const firstFailure = !state.syncError; state.syncError = true; if (firstFailure) toast(e.message || '同步暂不可用，会自动重试'); render(); }
  } finally {
    state.refreshing = false;
    const queued = state.refreshQueued || requestedDate !== state.date;
    state.refreshQueued = false;
    if (queued && !state.syncError && state.token) void refreshAll();
    else scheduleRefresh();
  }
}

// ===== 事件 =====
content.addEventListener('click', async (e) => {
  const t = e.target.closest('button') || e.target;
  if (t.id === 'show-help') { showWelcome(); return; }
  if (t.dataset.openPanel) { await openPanel(t.dataset.openPanel); return; }
  if (t.dataset.panel) { state.panel = t.dataset.panel; render(); return; }
  if (t.id === 'sync-retry') { await refreshAll(); return; }
  if (t.id === 'take-break' || t.dataset.startTask) {
    const task = state.tasks.find(item => item.id === t.dataset.startTask && item.owner_id === state.me.id && !item.is_completed);
    if (t.dataset.startTask && (!task || state.date !== today())) return;
    try {
      await shareStatus({ activity: 'idle', customActivity: task ? task.content.slice(0, 100) : '休息一下', focus: task ? 'focusing' : 'available' });
      await refreshAll(); toast(task ? '已分享：正在做这件事' : '休息一下，也很好');
    } catch (err) { toast(err.message); }
    return;
  }
  if (t.id === 'logout') {
    sessionGeneration++; clearTimeout(refreshTimer); state.syncError = false;
    state.token = ''; localStorage.removeItem('token'); localStorage.removeItem('cc_token'); state.me = null; state.pairInfo = null; state.statusDraft = ''; state.taskDraft = ''; state.reviewDrafts = {}; state.reviewOpenTaskId = null;
    content.innerHTML = ''; render(); return;
  }
  if (['pair-unbind', 'pair-cancel'].includes(t.id)) {
    if (t.id === 'pair-unbind' && !confirm('解除后双方停止共享状态和任务。历史记录保留且不向新伙伴展示。确定解除？')) return;
    try { await api('/api/pair/', { method: 'DELETE' }); state.pairInfo = null; content.innerHTML = ''; await refreshAll(); } catch (err) { toast(err.message); }
    return;
  }
  if (t.id === 'activity-save') {
    const input = document.getElementById('current-activity');
    const value = input.value.trim();
    if (!value) { toast('写一句你正在做什么吧'); return; }
    try { await shareStatus({ customActivity: value }); input.value = ''; state.statusDraft = ''; await refreshAll(); } catch (err) { toast(err.message); }
    return;
  }

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
    if (authSaving) return;
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value;
    if (!username || !password) { toast('请填写用户名和密码'); return; }
    if (state.authTab === 'register' && (!/^[A-Za-z0-9_一-龥]{2,20}$/.test(username) || password.length < 6)) { toast('用户名需 2–20 位，密码至少 6 位'); return; }
    authSaving = true; t.disabled = true; t.textContent = '正在连接…';
    try {
      let r;
      if (state.authTab === 'login') {
        r = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
      } else {
        const displayName = (document.getElementById('auth-display')?.value || '').trim() || username;
        r = await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, password, displayName }) });
      }
      sessionGeneration++; state.syncError = false;
      state.token = r.token;
      localStorage.setItem('token', r.token);
      state.me = r.user;
      toast('成功');
      await refreshAll();
    } catch (err) { toast(err.message); }
    finally { authSaving = false; t.disabled = false; t.textContent = state.authTab === 'login' ? '登录' : '注册'; }
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
    try { await shareStatus({ focus: t.dataset.setFocus }); await refreshAll(); } catch (err) { toast(err.message); }
    return;
  }
  if (t.dataset.setMood) {
    try { await shareStatus({ mood: t.dataset.setMood }); await refreshAll(); } catch (err) { toast(err.message); }
    return;
  }
  if (t.dataset.setActivity) {
    try { await shareStatus({ activity: t.dataset.setActivity, customActivity: '' }); await refreshAll(); } catch (err) { toast(err.message); }
    return;
  }

  if (t.id === 'slack-start') {
    try { await shareStatus({ focus: 'slacking' }); toast('开始摸鱼 🐟'); await refreshAll(); } catch (err) { toast(err.message); }
    return;
  }
  if (t.id === 'slack-stop') {
    try { await shareStatus({ focus: 'available' }); await refreshAll(); } catch (err) { toast(err.message); }
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

  if (t.dataset.reviewOpen) { state.reviewOpenTaskId = t.dataset.reviewOpen; state.reviewEmoji = state.reviewDrafts[t.dataset.reviewOpen]?.emoji || state.tasks.find(task => task.id === t.dataset.reviewOpen)?.reviews?.[0]?.emoji || 'cheer'; render(); return; }
  if (t.hasAttribute('data-review-cancel')) { delete state.reviewDrafts[state.reviewOpenTaskId]; state.reviewOpenTaskId = null; render(); return; }
  if (t.dataset.emoji) { state.reviewEmoji = t.dataset.emoji; state.reviewDrafts[state.reviewOpenTaskId] = { comment: document.getElementById('review-comment')?.value || '', emoji: state.reviewEmoji }; render(); return; }
  if (t.dataset.reviewSubmit) {
    const comment = document.getElementById('review-comment').value.trim();
    try {
      await api('/api/reviews', { method: 'PUT', body: JSON.stringify({ taskId: t.dataset.reviewSubmit, emoji: state.reviewEmoji, comment }) });
      delete state.reviewDrafts[state.reviewOpenTaskId];
      state.reviewOpenTaskId = null;
      toast('回应已发送');
      await refreshAll();
    } catch (err) { toast(err.message); }
    return;
  }
});

content.addEventListener('input', e => {
  if (e.target.id === 'current-activity') state.statusDraft = e.target.value;
  if (e.target.id === 'task-input') state.taskDraft = e.target.value;
  if (e.target.id === 'review-comment' && state.reviewOpenTaskId) state.reviewDrafts[state.reviewOpenTaskId] = { comment: e.target.value, emoji: state.reviewEmoji };
});

content.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.isComposing) return;
  if (e.target.id === 'task-input') addTask();
  if (e.target.id === 'current-activity') document.getElementById('activity-save')?.click();
  if (e.target.id === 'auth-username' || e.target.id === 'auth-password' || e.target.id === 'auth-display') {
    document.getElementById('auth-submit')?.click();
  }
  if (e.target.id === 'pair-code-input') document.getElementById('pair-join')?.click();
});

async function addTask() {
  const input = document.getElementById('task-input');
  if (!input || taskSaving || state.date !== today()) return;
  const text = input.value.trim();
  if (!text) return;
  taskSaving = true;
  const button = document.getElementById('task-add');
  if (button) button.disabled = true;
  try {
    await api('/api/tasks', { method: 'POST', body: JSON.stringify({ content: text, date: state.date }) });
    if (state.taskDraft.trim() === text) { input.value = ''; state.taskDraft = ''; }
    await refreshAll();
  } catch (err) { toast(err.message); }
  finally { taskSaving = false; if(button) button.disabled = false; }
}

// 标题栏与角落控件
function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value + 'T00:00:00Z').toISOString().slice(0,10) === value && value <= today();
}
document.getElementById('btn-mode').addEventListener('click', async () => {
  if (state.phase !== 'main') return;
  await saveConfig({ compact: state.config.compact === false }); render();
});
document.getElementById('btn-pin').addEventListener('click', async () => {
  if (!IS_NATIVE) return;
  await saveConfig({ alwaysOnTop: state.config.alwaysOnTop === false });
});
document.getElementById('btn-min').addEventListener('click', () => window.widget?.minimize());
document.getElementById('btn-close').addEventListener('click', () => window.widget?.hide());
document.getElementById('themes').addEventListener('click', async e => {
  const theme = e.target.dataset.theme;
  if (THEME_OPTIONS.some(([key]) => key === theme)) await saveConfig({ theme });
});
document.getElementById('plan-date').addEventListener('change', async e => {
  const value = e.target.value;
  if (!validDate(value)) { e.target.value = state.date; toast('请选择今天或过去的日期'); return; }
  state.date = value; state.taskDraft = ''; state.tasks = []; state.reviewOpenTaskId = null; state.reviewDrafts = {};
  await openPanel('tasks'); await refreshAll();
});
content.addEventListener('change', async e => {
  if (e.target.id === 'setting-pin') await saveConfig({ alwaysOnTop: e.target.checked });
  if (e.target.id === 'setting-autolaunch') await saveConfig({ autoLaunch: e.target.checked });
  if (e.target.id === 'setting-lock') await saveConfig({ positionLocked: e.target.checked });
  if (e.target.id === 'setting-snap') await saveConfig({ snapToEdge: e.target.checked });
  if (e.target.id === 'setting-duration') await saveConfig({ statusDurationMinutes: Number(e.target.value) });
});
content.addEventListener('contextmenu', e => {
  if (!e.target.closest('[data-person="mine"]')) return;
  e.preventDefault(); openQuickStatus();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeQuickStatus(true); document.getElementById('onboarding').hidden = true;
  }
  if ((e.key === 'ContextMenu' || e.key === 'F10' && e.shiftKey) && document.activeElement?.matches('[data-person="mine"]')) {
    e.preventDefault(); openQuickStatus();
  }
});
document.addEventListener('click', e => {
  if (!e.target.closest('#quick-status')) closeQuickStatus();
});
window.addEventListener('blur', () => closeQuickStatus());
document.getElementById('onboarding').addEventListener('click', e => {
  if (e.target.closest('#welcome-dismiss')) document.getElementById('onboarding').hidden = true;
});
document.getElementById('quick-status').addEventListener('click', async e => {
  const button = e.target.closest('button');
  if (!button) return;
  if (button.id === 'quick-close') { closeQuickStatus(true); return; }
  const activity = button.dataset.quickActivity;
  if (!ACTIVITY.some(a => a.k === activity) || statusSaving) return;
  const minutes = Number(document.getElementById('quick-duration').value);
  const panel = document.getElementById('quick-status');
  for (const control of panel.querySelectorAll('button,select')) control.disabled = true;
  try {
    const saved = await shareStatus({ activity, customActivity: activity === 'idle' ? '休息' : '', focus: ['study','work'].includes(activity) ? 'focusing' : 'available' }, minutes);
    if (saved) { closeQuickStatus(true); await refreshAll(); toast('状态已更新'); }
  } catch (err) { toast(err.message); }
  finally { for (const control of panel.querySelectorAll('button,select')) control.disabled = false; }
});
if (IS_NATIVE) bridge.onConfigChanged?.(config => { state.config = { ...state.config, ...config }; applyChrome(); });

// One scheduled read at a time; failed writes are never replayed automatically.
function scheduleRefresh() {
  clearTimeout(refreshTimer);
  if (!document || !state.token || document.visibilityState !== 'visible' || navigator.onLine === false) return;
  refreshTimer = setTimeout(() => void refreshAll(), CompanionConnection.retryDelay(failures, nextRetryAfter));
}
document.addEventListener('visibilitychange', () => {
  clearTimeout(refreshTimer);
  if (state.token && document.visibilityState === 'visible') void refreshAll();
});
window.addEventListener('online', () => { if (state.token) void refreshAll(); });
window.addEventListener('offline', () => {
  clearTimeout(refreshTimer); state.syncError = true; state.syncMessage = '网络已断开，恢复后自动重连'; render();
});

// 启动
(async () => {
  await loadConfig();
  render();
  if (state.token) {
    try { await refreshAll(); } catch (e) { render(); }
  } else {
    render();
  }
})();

if (!IS_NATIVE && 'serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
