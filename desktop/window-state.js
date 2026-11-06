'use strict';
// 260 px fits the existing calendar, seven theme dots and titlebar controls.
const SIZES = Object.freeze({ compact: { width: 260, height: 244 }, expanded: { width: 340, height: 560 }, auth: { width: 340, height: 460 } });
function windowBounds(mode, workArea, previous) {
  if (!previous || !['x', 'y', 'width', 'height'].every(key => Number.isFinite(previous[key])) || previous.width <= 0 || previous.height <= 0) previous = null;
  const size = SIZES[mode] || SIZES.compact;
  const width = Math.min(size.width, workArea.width);
  const height = Math.min(size.height, workArea.height);
  const right = previous ? previous.x + previous.width : workArea.x + workArea.width - 18;
  const bottom = previous ? previous.y + previous.height : workArea.y + workArea.height - 18;
  return { x: Math.round(Math.max(workArea.x, Math.min(right - width, workArea.x + workArea.width - width))), y: Math.round(Math.max(workArea.y, Math.min(bottom - height, workArea.y + workArea.height - height))), width, height };
}
function snapBounds(bounds, area) {
  const margin = 18, threshold = 32;
  const left = area.x, right = area.x + area.width - bounds.width;
  const top = area.y, bottom = area.y + area.height - bounds.height;
  const x = Math.abs(bounds.x - left) <= threshold ? Math.min(left + margin, right) : Math.abs(bounds.x - right) <= threshold ? Math.max(left, right - margin) : bounds.x;
  const y = Math.abs(bounds.y - top) <= threshold ? Math.min(top + margin, bottom) : Math.abs(bounds.y - bottom) <= threshold ? Math.max(top, bottom - margin) : bounds.y;
  return { ...bounds, x: Math.round(Math.max(left, Math.min(x, right))), y: Math.round(Math.max(top, Math.min(y, bottom))) };
}
module.exports = { SIZES, windowBounds, snapBounds };
