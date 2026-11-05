'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const read = path => fs.readFileSync(path, 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
async function until(check) {
  for (let i = 0; i < 30; i++) { if (check()) return; await tick(); }
  assert.ok(check(), 'expected UI state did not appear');
}
function desktop({ active = false } = {}) {
  const dom = new JSDOM(read('widget/index.html'), { url: 'https://widget.test', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window, calls = [];
  let paired = active;
  let activity = '';
  w.localStorage.setItem('token', 'test-token');
  w.widget = { getConfig: async () => ({ apiBase: 'https://to-gether-do.onrender.com' }), setConfig: async patch => patch, minimize() {}, hide() {} };
  w.confirm = () => true;
  w.fetch = async (url, opts = {}) => {
    const path = new URL(url).pathname, method = opts.method || 'GET';
    const body = opts.body ? JSON.parse(opts.body) : null;
    calls.push({ path, method, body });
    let data = {};
    if (path === '/api/auth/me') data = { user: { id: 'a', displayName: '我' } };
    else if (path === '/api/pair/code') data = { status: 'waiting', code: 'ABC234' };
    else if (path === '/api/pair/' && method === 'DELETE') { paired = false; data = { ok: true }; }
    else if (path === '/api/pair/') data = paired ? { status: 'active', pairId: 'pair-1', partner: { id: 'b', displayName: '伙伴' } } : { status: 'none' };
    else if (path === '/api/tasks') data = { tasks: [{ id: 'task-b', owner_id: 'b', content: '读书', reviews: [] }] };
    else if (path === '/api/status') {
      if (method === 'PUT') activity = body.customActivity || '';
      data = { mine: { activity: 'study', custom_activity: activity, updated_at: new Date().toISOString() }, theirs: { activity: 'work', custom_activity: '<script>hello</script>', focus: 'focusing', updated_at: new Date().toISOString() } };
    } else if (path === '/api/slack/stats') data = { stats: {} };
    return { ok: true, status: 200, json: async () => data };
  };
  w.eval(read('widget/ui-state.js') + ';window.renderPreservingDrafts = renderPreservingDrafts; window.relativeStatusTime = relativeStatusTime;');
  w.eval(read('widget/app.js') + ';window.__refreshAll = refreshAll;');
  return { dom, w, calls };
}
test('desktop loads unpaired account without requesting pair-only data and shows generated code', async () => {
  const { dom, w, calls } = desktop();
  try {
    await until(() => w.document.getElementById('pair-create'));
    assert.equal(calls.some(c => c.path === '/api/tasks'), false);
    w.document.getElementById('pair-create').click();
    await until(() => w.document.querySelector('.pair-code'));
    assert.equal(w.document.querySelector('.pair-code').textContent, 'ABC234');
  } finally { dom.window.close(); }
});
test('desktop keeps drafts across refresh and emoji selection, sends taskId and unbinds', async () => {
  const { dom, w, calls } = desktop({ active: true });
  try {
    await until(() => w.document.getElementById('current-activity'));
    assert.equal(w.document.querySelector('.current-activity').textContent, '<script>hello</script>');
    assert.equal(w.document.querySelector('.current-activity script'), null);
    const tasks = w.document.getElementById('daily-tasks'); tasks.open = true;
    const input = w.document.getElementById('task-input'); input.value = '未提交的任务';
    await w.__refreshAll();
    assert.equal(w.document.getElementById('task-input').value, '未提交的任务');
    assert.equal(w.document.getElementById('daily-tasks').open, true);
    w.document.querySelector('[data-review-open]').click();
    w.document.getElementById('review-comment').value = '继续加油';
    w.document.querySelector('[data-emoji="hug"]').click();
    assert.equal(w.document.getElementById('review-comment').value, '继续加油');
    w.document.querySelector('[data-review-submit]').click();
    await until(() => calls.some(c => c.path === '/api/reviews'));
    const sent = calls.find(c => c.path === '/api/reviews').body;
    assert.equal(sent.taskId, 'task-b'); assert.equal(sent.comment, '继续加油'); assert.equal(sent.emoji, 'hug');
    await until(() => !w.document.getElementById('review-comment'));
    w.document.getElementById('pair-unbind').click();
    await until(() => w.document.getElementById('pair-create'));
    assert.ok(calls.some(c => c.path === '/api/pair/' && c.method === 'DELETE'));
  } finally { dom.window.close(); }
});
test('draft helper preserves independent forms, focus, expanded sections and timestamp fallback', () => {
  const dom = new JSDOM('<div id="root"></div>', { runScripts: 'outside-only' });
  const w = dom.window; w.eval(read('public/ui-state.js') + ';window.renderPreservingDrafts = renderPreservingDrafts; window.relativeStatusTime = relativeStatusTime;');
  const markup = '<details id="plans"><summary>计划</summary><form onsubmit="sendComment(event,1)"><input name="comment"></form><form onsubmit="sendComment(event,2)"><input name="comment"></form></details>';
  w.document.getElementById('root').innerHTML = markup;
  const inputs = w.document.querySelectorAll('input'); inputs[0].value = '第一条'; inputs[1].value = '第二条'; inputs[1].focus(); inputs[1].setSelectionRange(1, 2);
  w.document.querySelector('details').open = true;
  w.eval(`renderPreservingDrafts(document.getElementById('root'), () => { document.getElementById('root').innerHTML = ${JSON.stringify(markup)}; })`);
  assert.deepEqual([...w.document.querySelectorAll('input')].map(el => el.value), ['第一条', '第二条']);
  assert.equal(w.document.activeElement.selectionStart, 1); assert.equal(w.document.querySelector('details').open, true);
  assert.equal(w.eval('relativeStatusTime(undefined)'), '尚未更新');
  dom.window.close();
});
test('web prioritizes current activity, keeps independent drafts and exits when partner unbinds', async () => {
  const dom = new JSDOM(read('public/index.html'), { url: 'https://app.test', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  let paired = true;
  const person = (id, displayName) => ({ id, displayName });
  w.localStorage.setItem('cc_token', 'test-token');
  w.fetch = async (url) => {
    const path = new URL(url, 'https://app.test').pathname;
    let data;
    if (path === '/api/auth/me') data = { user: person('a', '我') };
    else if (path === '/api/pair') data = paired ? { status: 'active', pairId: 'one', partner: person('b', '伙伴') } : { status: 'none' };
    else if (path === '/api/tasks') data = { tasks: [{ id: 'task-b', owner_id: 'b', content: '读书', reviews: [] }], users: { me: person('a', '我'), partner: person('b', '伙伴') }, progress: { a: { done: 0, total: 0 }, b: { done: 0, total: 1 } } };
    else if (path === '/api/status') data = { mine: { user: person('a', '我'), activity: 'study', updated_at: new Date().toISOString() }, theirs: { user: person('b', '伙伴'), activity: 'work', custom_activity: '写论文', updated_at: new Date().toISOString() } };
    else if (path === '/api/slack/stats') data = { stats: {} };
    else if (path === '/api/slack/history') data = { history: [] };
    return { ok: true, json: async () => data };
  };
  try {
    w.eval(read('public/ui-state.js') + ';window.renderPreservingDrafts = renderPreservingDrafts; window.relativeStatusTime = relativeStatusTime;');
    w.eval(read('public/app.js') + ';window.__refresh = refreshAll; window.__render = render;');
    await until(() => w.document.querySelector('.current-activity'));
    assert.equal(w.document.querySelector('.current-activity').textContent, '写论文');
    assert.equal(w.document.getElementById('daily-tasks').open, false);
    w.document.querySelector('input[name="currentActivity"]').value = '未分享的状态';
    w.document.querySelector('input[name="comment"]').value = '未发送的留言';
    w.document.getElementById('daily-tasks').open = true;
    await w.__refresh(); w.__render();
    assert.equal(w.document.querySelector('input[name="currentActivity"]').value, '未分享的状态');
    assert.equal(w.document.querySelector('input[name="comment"]').value, '未发送的留言');
    assert.equal(w.document.getElementById('daily-tasks').open, true);
    paired = false; await w.__refresh();
    assert.equal(w.document.querySelector('.current-activity'), null);
    assert.match(w.document.getElementById('app').textContent, /和 TA 绑定/);
  } finally { dom.window.close(); }
});
