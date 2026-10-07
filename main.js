'use strict';

const { app, BrowserWindow, Tray, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let tray = null;

const configPath = () => path.join(app.getPath('userData'), 'config.json');

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath(), 'utf8'));
  } catch (e) {
    return { apiBase: '', autoLaunch: false, alwaysOnTop: true };
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
  mainWindow = new BrowserWindow({
    width: 340,
    height: 560,
    frame: false,
    transparent: true,
    resizable: false,
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
      label: '始终置顶',
      type: 'checkbox',
      checked: cfg.alwaysOnTop !== false,
      click: (item) => {
        const c = readConfig();
        c.alwaysOnTop = item.checked;
        writeConfig(c);
        if (mainWindow) mainWindow.setAlwaysOnTop(item.checked);
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
  tray = new Tray(path.join(__dirname, 'build', 'icon.png'));
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
  const c = { ...readConfig(), ...patch };
  writeConfig(c);
  if (patch.autoLaunch !== undefined) {
    app.setLoginItemSettings({ openAtLogin: !!patch.autoLaunch });
  }
  if (patch.alwaysOnTop !== undefined && mainWindow) {
    mainWindow.setAlwaysOnTop(!!patch.alwaysOnTop);
  }
  updateTrayMenu();
  return c;
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
    const cfg = readConfig();
    if (cfg.autoLaunch) app.setLoginItemSettings({ openAtLogin: true });
  });
}

app.on('window-all-closed', (e) => e.preventDefault());
