'use strict';

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

/**
 * Run Windows NSIS updates via GitHub Releases.
 * Dependencies are injectable for offline regression tests.
 */
function createAutoUpdateController({
  app,
  dialog,
  autoUpdater,
  logger = console,
  platform = process.platform,
  intervalMs = CHECK_INTERVAL_MS,
  scheduleInterval = setInterval,
  clearScheduledInterval = clearInterval,
}) {
  if (!app.isPackaged || platform !== 'win32') {
    return { checkForUpdates: async () => false, stop: () => {} };
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = false;

  let checking = false;
  let downloaded = false;
  let installing = false;
  let prompting = false;
  let manualCheck = false;
  let stopped = false;
  let downloadedVersion = '';
  const logError = (error) => logger.error('Desktop update:', error);

  async function promptToInstall() {
    if (!downloaded || prompting || installing || stopped) return;
    prompting = true;
    try {
      const { response } = await dialog.showMessageBox({
        type: 'info',
        title: '伙伴打卡 · 软件更新',
        message: '新版本已下载完成',
        detail: downloadedVersion
          ? '版本 ' + downloadedVersion + ' 已准备好。立即重启并安装更新吗？'
          : '立即重启并安装更新吗？',
        buttons: ['立即更新', '稍后'],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
      });
      if (response === 0) {
        installing = true;
        // The existing close handler normally hides the tray window.
        app.isQuitting = true;
        autoUpdater.quitAndInstall(false, true);
      }
    } catch (error) {
      logError(error);
    } finally {
      prompting = false;
    }
  }

  async function checkForUpdates(manual = false) {
    if (stopped || installing) return false;
    if (downloaded) {
      if (manual) await promptToInstall();
      return false;
    }
    if (checking) return false;
    checking = true;
    manualCheck = Boolean(manual);
    try {
      await autoUpdater.checkForUpdates();
      return true;
    } catch (error) {
      logError(error);
      if (manual) {
        try {
          await dialog.showMessageBox({
            type: 'warning',
            title: '检查更新失败',
            message: '暂时无法连接更新服务',
            detail: '请检查网络连接，稍后重试。',
            buttons: ['确定'],
            noLink: true,
          });
        } catch (dialogError) {
          logError(dialogError);
        }
      }
      return false;
    } finally {
      checking = false;
      manualCheck = false;
    }
  }

  const handlers = {
    'update-available': (info) => {
      logger.info('Desktop update available:', info.version);
      manualCheck = false;
    },
    'update-not-available': () => {
      if (manualCheck && !stopped) {
        void dialog.showMessageBox({
          type: 'info',
          title: '伙伴打卡 · 检查更新',
          message: '当前已经是最新版本',
          buttons: ['确定'],
          noLink: true,
        }).catch(logError);
      }
    },
    'update-downloaded': (info) => {
      downloaded = true;
      downloadedVersion = info.version || '';
      void promptToInstall();
    },
    error: logError,
  };

  for (const [event, handler] of Object.entries(handlers)) {
    autoUpdater.on(event, handler);
  }

  const timer = scheduleInterval(() => { void checkForUpdates(); }, intervalMs);
  if (timer && typeof timer.unref === 'function') timer.unref();
  void checkForUpdates();

  function stop() {
    stopped = true;
    clearScheduledInterval(timer);
    for (const [event, handler] of Object.entries(handlers)) {
      autoUpdater.removeListener(event, handler);
    }
  }

  return { checkForUpdates, stop };
}

module.exports = { createAutoUpdateController, CHECK_INTERVAL_MS };
