'use strict';
function relativeStatusTime(iso) {
  const time = Date.parse(iso);
  if (!Number.isFinite(time) || time <= 0) return '尚未更新';
  const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000));
  if (minutes < 1) return '刚刚更新';
  if (minutes < 60) return minutes + ' 分钟前更新';
  if (minutes < 1440) return Math.floor(minutes / 60) + ' 小时前更新';
  return Math.floor(minutes / 1440) + ' 天前更新';
}
function renderPreservingDrafts(root, draw) {
  const key = el => el.dataset.draftKey || el.id || (el.closest('form')?.getAttribute('onsubmit') || '') + ':' + el.name;
  const eligible = el => !['password', 'hidden', 'checkbox'].includes(el.type) && !/auth-|setup-|pair-|username|password|displayName|code/.test(el.id || el.name);
  const drafts = new Map([...root.querySelectorAll('input, textarea')].filter(eligible).map(el => [key(el), { value: el.value, focused: el === document.activeElement, start: el.selectionStart, end: el.selectionEnd }]));
  const open = new Map([...root.querySelectorAll('details[id]')].map(el => [el.id, el.open]));
  const scroll = root.scrollTop;
  draw();
  for (const el of root.querySelectorAll('input, textarea')) {
    const draft = eligible(el) && drafts.get(key(el));
    if (!draft) continue;
    el.value = draft.value;
    if (draft.focused) { el.focus({ preventScroll: true }); if (el.setSelectionRange && draft.start !== null) el.setSelectionRange(draft.start, draft.end); }
  }
  for (const el of root.querySelectorAll('details[id]')) if (open.has(el.id)) el.open = open.get(el.id);
  root.scrollTop = scroll;
}
