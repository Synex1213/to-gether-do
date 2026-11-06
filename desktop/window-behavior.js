'use strict';
const { snapBounds } = require('./window-state');

function attachWindowBehavior(win, { getConfig, getWorkArea, persistBounds }) {
  let saveTimer;
  let snapping = false;
  win.on('will-move', event => {
    if (getConfig().positionLocked) event.preventDefault();
  });
  // Windows emits moved after a manual drag, not after setBounds used by modes.
  win.on('moved', () => {
    const cfg = getConfig();
    if (snapping || cfg.positionLocked || cfg.snapToEdge === false) return;
    const current = win.getBounds();
    const next = snapBounds(current, getWorkArea(current));
    if (next.x === current.x && next.y === current.y) return;
    snapping = true;
    try { win.setBounds(next); } finally { snapping = false; }
  });
  win.on('move', () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (!win.isDestroyed()) persistBounds(win.getBounds());
    }, 250);
  });
  win.on('closed', () => clearTimeout(saveTimer));
}
module.exports = { attachWindowBehavior };
