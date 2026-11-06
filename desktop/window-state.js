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
module.exports = { SIZES, windowBounds };
