'use strict';

const { app, BrowserWindow, Tray, Menu, ipcMain, dialog, screen, nativeImage } = require('electron');
const { createAutoUpdateController } = require('./desktop/updater');
const { normalizeConfig } = require('./desktop/config');
const { windowBounds } = require('./desktop/window-state');
const { attachWindowBehavior } = require('./desktop/window-behavior');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let tray = null;
let updateController = { checkForUpdates: async () => false };

const configPath = () => path.join(app.getPath('userData'), 'config.json');

function readConfig() {
  try {
    return normalizeConfig(JSON.parse(fs.readFileSync(configPath(), 'utf8')));
  } catch (e) {
    return normalizeConfig();
  }
}

function writeConfig(cfg) {
  try {
    fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2));
  } catch (e) {
    /* ignore */
  }
}

function createWindow() {
  const cfg = readConfig();
  const saved = cfg.windowBounds;
  const validSaved = saved && ['x','y','width','height'].every(key => Number.isFinite(saved[key])) && saved.width > 0 && saved.height > 0;
  const display = validSaved ? screen.getDisplayMatching(saved) : screen.getPrimaryDisplay();
  mainWindow = new BrowserWindow({
    ...windowBounds(cfg.compact ? 'compact' : 'expanded', display.workArea, validSaved ? saved : undefined),
    frame: false,
    transparent: true,
    resizable: false,
    movable: !cfg.positionLocked,
    alwaysOnTop: cfg.alwaysOnTop !== false,
    skipTaskbar: false,
    show: false,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'widget', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  attachWindowBehavior(mainWindow, {
    getConfig: readConfig,
    getWorkArea: bounds => screen.getDisplayMatching(bounds).workArea,
    persistBounds: bounds => writeConfig({ ...readConfig(), windowBounds: bounds }),
  });

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function updateTrayMenu() {
  if (!tray) return;
  const cfg = readConfig();
  const menu = Menu.buildFromTemplate([
    {
      label: '显示 / 隐藏',
      click: () => {
        if (!mainWindow) return;
        if (mainWindow.isVisible()) mainWindow.hide();
        else { mainWindow.show(); mainWindow.focus(); }
      },
    },
    { type: 'separator' },
    {
      label: '锁定窗口位置', type: 'checkbox', checked: cfg.positionLocked,
      click: item => {
        const c = normalizeConfig({ ...readConfig(), positionLocked: item.checked });
        writeConfig(c);
        if (mainWindow) { mainWindow.setMovable(!c.positionLocked); mainWindow.webContents.send('config:changed', c); }
      },
    },
    {
      label: '检查软件更新',
      enabled: app.isPackaged && process.platform === 'win32',
      click: () => { void updateController.checkForUpdates(true); },
    },
    {
      label: '始终置顶',
      type: 'checkbox',
      checked: cfg.alwaysOnTop !== false,
      click: (item) => {
        const c = readConfig();
        c.alwaysOnTop = item.checked;
        writeConfig(c);
        if (mainWindow) { mainWindow.setAlwaysOnTop(item.checked); mainWindow.webContents.send('config:changed', c); }
      },
    },
    {
      label: '开机自启',
      type: 'checkbox',
      checked: cfg.autoLaunch === true,
      click: (item) => {
        const c = readConfig();
        c.autoLaunch = item.checked;
        writeConfig(c);
        app.setLoginItemSettings({ openAtLogin: item.checked });
        if (mainWindow) mainWindow.webContents.send('config:changed', c);
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'build', 'icon.png')).resize({ width: 20, height: 20 }));
  tray.setToolTip('伙伴打卡');
  updateTrayMenu();
  tray.on('click', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) mainWindow.hide();
    else { mainWindow.show(); mainWindow.focus(); }
  });
}

// ===== IPC =====
ipcMain.handle('config:get', () => readConfig());

ipcMain.handle('config:set', (_e, patch) => {
  patch = patch && typeof patch === 'object' ? patch : {};
  const allowed = {};
  for (const key of ['theme', 'compact', 'alwaysOnTop', 'autoLaunch', 'apiBase', 'snapToEdge', 'positionLocked', 'onboardingSeen', 'statusDurationMinutes', 'recentActivities']) if (Object.hasOwn(patch, key)) allowed[key] = patch[key];
  const c = normalizeConfig({ ...readConfig(), ...allowed });
  writeConfig(c);
  if (patch.positionLocked !== undefined && mainWindow) mainWindow.setMovable(!c.positionLocked);
  if (patch.autoLaunch !== undefined) {
    app.setLoginItemSettings({ openAtLogin: !!patch.autoLaunch });
  }
  if (patch.alwaysOnTop !== undefined && mainWindow) {
    mainWindow.setAlwaysOnTop(!!patch.alwaysOnTop);
  }
  updateTrayMenu();
  if (mainWindow) mainWindow.webContents.send('config:changed', c);
  return c;
});

ipcMain.handle('window:mode', (_e, mode) => {
  if (!['compact', 'expanded', 'auth'].includes(mode) || !mainWindow) return false;
  const current = mainWindow.getBounds();
  const display = screen.getDisplayMatching(current);
  mainWindow.setBounds(windowBounds(mode, display.workArea, current));
  if (mode !== 'auth') writeConfig({ ...readConfig(), compact: mode === 'compact', windowBounds: mainWindow.getBounds() });
  return true;
});

ipcMain.handle('window:minimize', () => mainWindow && mainWindow.minimize());
ipcMain.handle('window:hide', () => mainWindow && mainWindow.hide());
ipcMain.handle('app:quit', () => {
  app.isQuitting = true;
  app.quit();
});
ipcMain.handle('app:version', () => app.getVersion());

// ===== 单实例 =====
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
  });
  app.whenReady().then(() => {
    createWindow();
    createTray();
    if (app.isPackaged && process.platform === 'win32') {
      const { autoUpdater } = require('electron-updater');
      updateController = createAutoUpdateController({ app, dialog, autoUpdater });
    }
    const cfg = readConfig();
    if (cfg.autoLaunch) app.setLoginItemSettings({ openAtLogin: true });
  });
}

app.on('window-all-closed', (e) => e.preventDefault());
