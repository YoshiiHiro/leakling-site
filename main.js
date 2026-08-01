const { app, BrowserWindow, globalShortcut, ipcMain, Tray, Menu, nativeImage, desktopCapturer } = require('electron');
const path = require('path');
const fs = require('fs');
const modelService = require('./model-service.js');
const { createWorker } = require('tesseract.js');

let desktopWindow = null;
let overlayWindow = null;
let tray = null;

// ── Icon loader ───────────────────────────────────────────────────

const PNG_ICON_PATH = path.join(__dirname, 'icons', 'window-icon.png');

function loadAppIcon(size = 32) {
  try {
    const img = nativeImage.createFromPath(PNG_ICON_PATH);
    if (img.isEmpty()) throw new Error('empty image');
    return img.resize({ width: size, height: size, quality: 'best' });
  } catch {
    // Fallback: old tray icon
    try { return nativeImage.createFromPath(path.join(__dirname, 'icons', 'IconMouseOver.png')).resize({ width: size, height: size }); } catch { return nativeImage.createEmpty(); }
  }
}

// ── Crash log system ──────────────────────────────────────────────

const CRASH_LOG_DIR = path.join(app.getPath('userData'), 'crash-logs');

function ensureCrashDir() {
  try {
    if (!fs.existsSync(CRASH_LOG_DIR)) {
      fs.mkdirSync(CRASH_LOG_DIR, { recursive: true });
    }
  } catch (err) {
    console.error('[CrashLog] failed to create crash log dir:', err);
  }
}

function getCrashLogPath() {
  const now = new Date();
  const ts = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  return path.join(CRASH_LOG_DIR, `crash-${ts}.json`);
}

function writeCrashLog(data) {
  try {
    ensureCrashDir();
    const logPath = getCrashLogPath();
    const entry = {
      timestamp: new Date().toISOString(),
      ...data,
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        electronVersion: process.versions?.electron || 'unknown',
        chromeVersion: process.versions?.chrome || 'unknown',
      },
    };
    fs.writeFileSync(logPath, JSON.stringify(entry, null, 2), 'utf-8');
    console.log('[CrashLog] written:', logPath);
    return logPath;
  } catch (err) {
    console.error('[CrashLog] write failed:', err);
  }
}

// ── Process-level crash handlers ──────────────────────────────────

process.on('uncaughtException', (error, origin) => {
  writeCrashLog({
    type: 'uncaughtException',
    origin,
    message: error?.message || String(error),
    stack: error?.stack || null,
  });
  // Give the log a moment to flush, then exit
  setTimeout(() => {
    app.isQuitting = true;
    app.exit(1);
  }, 200);
});

process.on('unhandledRejection', (reason, promise) => {
  writeCrashLog({
    type: 'unhandledRejection',
    message: reason?.message || String(reason),
    stack: reason?.stack || null,
  });
});

// ── Window creation ────────────────────────────────────────────────

function createDesktopWindow() {
  desktopWindow = new BrowserWindow({
    width: 1000,
    height: 736,
    minWidth: 720,
    minHeight: 480,
    icon: loadAppIcon(32),
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false
  });

  // Load Vite-built React app
  desktopWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));

  desktopWindow.once('ready-to-show', () => {
    desktopWindow.show();
  });

  desktopWindow.on('close', (e) => {
    // User-initiated close — quit the app cleanly
    if (!app.isQuitting) {
      app.isQuitting = true;
      app.quit();
    }
  });

  desktopWindow.on('closed', () => {
    desktopWindow = null;
  });
}

function createOverlayWindow() {
  overlayWindow = new BrowserWindow({
    width: 240,
    height: 56,
    x: 40,
    y: 120,
    transparent: true,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    }
  });

  overlayWindow.loadFile(path.join(__dirname, 'windows', 'in-game', 'in-game.html'));

  // Hide overlay when it loses focus (like a real in-game overlay)
  overlayWindow.on('blur', () => {
    // Don't hide immediately - let the user click a tag button first
    // The overlay will be hidden by the timer or user action
  });

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
}

// ── System tray ────────────────────────────────────────────────────

function createTray() {
  let trayIcon;
  try {
    trayIcon = loadAppIcon(16);
    if (trayIcon.isEmpty()) throw new Error('empty icon');
  } catch {
    return; // Skip tray if icon fails
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('Leakling');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Leakling',
      click: () => {
        if (desktopWindow) desktopWindow.show();
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => {
    if (desktopWindow) desktopWindow.show();
  });
}

// ── Global shortcuts ───────────────────────────────────────────────

let _registeredHotkeys = {};

function registerShortcut(accelerator, handler) {
  try {
    globalShortcut.register(accelerator, handler);
    return true;
  } catch {
    return false;
  }
}

function registerShortcuts(toggleKey, tagKey) {
  // Unregister all previous
  Object.keys(_registeredHotkeys).forEach((k) => {
    try { globalShortcut.unregister(k); } catch {}
  });
  _registeredHotkeys = {};

  const tKey = toggleKey || 'CommandOrControl+Shift+A';
  const dKey = tagKey || 'CommandOrControl+Shift+D';

  registerShortcut(tKey, () => {
    if (overlayWindow && overlayWindow.isVisible()) {
      overlayWindow.hide();
      if (desktopWindow) desktopWindow.webContents.send('hotkey', 'autopsy_showhide');
    } else {
      if (desktopWindow) {
        if (desktopWindow.isVisible()) desktopWindow.hide();
        else desktopWindow.show();
      }
    }
  });
  _registeredHotkeys[tKey] = 'toggle';

  registerShortcut(dKey, () => {
    if (desktopWindow) desktopWindow.webContents.send('hotkey', 'autopsy_mock_death');
  });
  _registeredHotkeys[dKey] = 'tag';
}

// ── IPC handlers ───────────────────────────────────────────────────

// Window controls
ipcMain.handle('window:minimize', () => {
  if (desktopWindow) desktopWindow.minimize();
});

ipcMain.handle('window:close', () => {
  if (desktopWindow) desktopWindow.close();
});

ipcMain.handle('window:hideToTray', () => {
  if (desktopWindow) desktopWindow.hide();
});

ipcMain.handle('window:showFromTray', () => {
  if (desktopWindow) {
    desktopWindow.show();
    desktopWindow.focus();
  }
});

ipcMain.handle('window:resizeToContent', (_, contentHeight) => {
  if (!desktopWindow || desktopWindow.isDestroyed()) return;
  const frameDiff = 736 - 700; // 36px title bar
  const newHeight = Math.max(480, Math.min(1080, contentHeight + frameDiff));
  const [w] = desktopWindow.getSize();
  desktopWindow.setSize(w, newHeight);
});

// Overlay control
ipcMain.handle('overlay:show', (_, opts = {}) => {
  if (!overlayWindow) return;

  const { width: screenW, height: screenH } = require('electron').screen.getPrimaryDisplay().workAreaSize;
  const ow = 240, oh = 56;

  // Calculate position
  const pos = (opts.position || 'top_right').toLowerCase().replace(' ', '_');
  let x = 40, y = 120;
  if (pos === 'top_left') { x = 20; y = 20; }
  else if (pos === 'top_right') { x = screenW - ow - 20; y = 20; }
  else if (pos === 'bottom_left') { x = 20; y = screenH - oh - 20; }
  else if (pos === 'bottom_right') { x = screenW - ow - 20; y = screenH - oh - 20; }

  overlayWindow.setPosition(x, y);

  // Apply opacity
  const opacity = typeof opts.opacity === 'number' ? opts.opacity / 100 : 0.75;
  overlayWindow.setOpacity(opacity);

  overlayWindow.show();
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.focus();
});

ipcMain.handle('overlay:hide', () => {
  if (overlayWindow) overlayWindow.hide();
});

// Real-time overlay position update
ipcMain.handle('overlay:setPosition', (_, pos) => {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  const { width: screenW, height: screenH } = require('electron').screen.getPrimaryDisplay().workAreaSize;
  const ow = 240, oh = 56;
  const p = (pos || 'top_right').toLowerCase().replace(' ', '_');
  let x = 40, y = 120;
  if (p === 'top_left') { x = 20; y = 20; }
  else if (p === 'top_right') { x = screenW - ow - 20; y = 20; }
  else if (p === 'bottom_left') { x = 20; y = screenH - oh - 20; }
  else if (p === 'bottom_right') { x = screenW - ow - 20; y = screenH - oh - 20; }
  overlayWindow.setPosition(x, y);
});

ipcMain.handle('overlay:setOpacity', (_, opacity) => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    const val = typeof opacity === 'number' ? opacity / 100 : 0.75;
    overlayWindow.setOpacity(val);
  }
});

// Forward overlay death event (desktop → overlay)
ipcMain.on('overlay:sendDeathEvent', (_, deathData) => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('overlay:deathEvent', deathData);
  }
});

// Forward tag event from overlay back to desktop
ipcMain.on('overlay:sendTagEvent', (_, tagData) => {
  if (desktopWindow && !desktopWindow.isDestroyed()) {
    desktopWindow.webContents.send('overlay:tagEvent', tagData);
  }
});

// Forward skip event from overlay back to desktop
ipcMain.on('overlay:sendSkipEvent', (_, skipData) => {
  if (desktopWindow && !desktopWindow.isDestroyed()) {
    desktopWindow.webContents.send('overlay:skipEvent', skipData);
  }
});

// Forward force-dismiss from overlay back to desktop
ipcMain.on('overlay:sendDismissEvent', (_, dismissData) => {
  if (desktopWindow && !desktopWindow.isDestroyed()) {
    desktopWindow.webContents.send('overlay:dismissEvent', dismissData);
  }
});

// Overlay ready signal (overlay → desktop)
ipcMain.on('overlay:ready', () => {
  if (desktopWindow && !desktopWindow.isDestroyed()) {
    desktopWindow.webContents.send('overlay:ready');
  }
});

// ── Crash log IPC (renderer → main) ───────────────────────────────

ipcMain.on('crash:log', (_, data) => {
  writeCrashLog({
    type: data?.type || 'renderer_error',
    source: data?.source || 'desktop',
    message: data?.message || '(no message)',
    stack: data?.stack || null,
    url: data?.url || null,
    line: data?.line || null,
    col: data?.col || null,
  });
});

// ── Screen capture IPC ────────────────────────────────────────────

// Window-name hints for common video players / media viewers.
// The demo treats a playing video as a valid capture source too, so Riot
// can verify the model on a clip playing in a media player.
const VIDEO_VIEWER_KEYWORDS = [
  'vlc', 'media player', 'mpv', 'potplayer', 'kmplayer', 'gom player',
  'movies & tv', 'films & tv', 'media player classic', 'mpc-hc',
  'video player', 'player',
];
const VIDEO_EXT_RE = /\.(mp4|mkv|mov|avi|webm|wmv|flv|m4v|m2ts|ts|mpg|mpeg|3gp)(\s|$|")/i;

function isVideoViewerWindow(name) {
  if (!name) return false;
  const n = name.toLowerCase();
  if (VIDEO_EXT_RE.test(n)) return true;
  return VIDEO_VIEWER_KEYWORDS.some((k) => n.includes(k));
}

/**
 * True only if the window is the actual Valorant game client.
 * The game window title is exactly "VALORANT". We deliberately do NOT use a
 * substring match — otherwise a video file named "Valorant_07-15.mp4" playing
 * in a viewer would be mistaken for the game.
 */
function isValorantWindow(name) {
  return !!name && name.trim().toUpperCase() === 'VALORANT';
}

/** Find a window source (and the display index it's on) matching a predicate. */
async function findWindowSource(predicate) {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: 1, height: 1 }, // minimal — just need the name
    });
    for (const s of sources) {
      if (predicate(s.name)) {
        let screenIndex = 0;
        try {
          const displays = require('electron').screen.getAllDisplays();
          const did = String(s.display_id || '');
          if (did) {
            const match = displays.find((d) => String(d.id) === did);
            if (match) screenIndex = displays.indexOf(match);
          }
        } catch {}
        return { source: s, screenIndex };
      }
    }
  } catch {}
  return null;
}

/** Capture a window thumbnail for the first window matching a predicate. */
async function captureWindowByName(predicate, opts = {}) {
  const thumbW = (opts && opts.width) || 960;
  const thumbH = (opts && opts.height) || 540;
  const sources = await desktopCapturer.getSources({
    types: ['window'],
    thumbnailSize: { width: thumbW, height: thumbH },
  });
  for (const s of sources) {
    if (predicate(s.name)) {
      const thumbnail = s.thumbnail;
      if (!thumbnail || thumbnail.isEmpty()) {
        return { success: false, error: `Window "${s.name}" returned an empty thumbnail (minimized or hidden?)` };
      }
      const dataUrl = thumbnail.toDataURL(10);
      const size = Buffer.from(dataUrl.split(',')[1], 'base64').length;
      return {
        success: true,
        dataUrl,
        width: thumbnail.getSize().width,
        height: thumbnail.getSize().height,
        bytes: size,
        name: s.name,
      };
    }
  }
  return { success: false, error: 'No matching window found (is the video player open and visible?)' };
}

/**
 * Detect available displays and check for capture sources (Valorant window
 * and/or a video viewer for the demo).
 * Returns: { displays, valorantScreenIndex, videoViewerScreenIndex, ... }
 */
ipcMain.handle('screen:detect', async () => {
  try {
    const displays = require('electron').screen.getAllDisplays();
    const displayInfo = displays.map((d, i) => ({
      index: i,
      id: d.id,
      internal: d.internal,
      bounds: d.bounds,
      size: d.size,
      primary: d.id === require('electron').screen.getPrimaryDisplay().id,
    }));

    // Find which display has the Valorant window (live game source)
    const valorant = await findWindowSource(isValorantWindow);
    // For the demo: also accept a video viewer (e.g. VLC) as a capture source
    const videoViewer = await findWindowSource(isVideoViewerWindow);

    return {
      success: true,
      displays: displayInfo,
      valorantScreenIndex: valorant ? valorant.screenIndex : null,
      videoViewerScreenIndex: videoViewer ? videoViewer.screenIndex : null,
      valorantFound: !!valorant,
      videoViewerFound: !!videoViewer,
    };
  } catch (err) {
    console.error('[Screen] detect error:', err);
    return { success: false, error: String(err) };
  }
});

/**
 * Capture a snapshot from a specific screen (by index).
 * @param _ event
 * @param screenIndex - 0 = primary display, 1 = secondary, etc.
 * @param opts - { width?, height? } thumbnail size override (default 320x180)
 */
ipcMain.handle('screen:snap', async (_, screenIndex = 0, opts = {}) => {
  try {
    const thumbW = (opts && opts.width) || 320;
    const thumbH = (opts && opts.height) || 180;
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: thumbW, height: thumbH }
    });

    if (!sources || sources.length === 0) {
      return { success: false, error: 'No screen sources' };
    }

    const idx = Math.min(screenIndex, sources.length - 1);
    const source = sources[idx];
    if (!source) return { success: false, error: `Screen index ${idx} not available` };

    const thumbnail = source.thumbnail;
    if (thumbnail.isEmpty()) {
      return { success: false, error: 'Empty thumbnail' };
    }

    const dataUrl = thumbnail.toDataURL(10);
    const size = Buffer.from(dataUrl.split(',')[1], 'base64').length;

    return {
      success: true,
      dataUrl,
      width: thumbnail.getSize().width,
      height: thumbnail.getSize().height,
      bytes: size,
      screenIndex: idx,
      screenName: source.name,
    };
  } catch (err) {
    console.error('[Snap] capture error:', err);
    return { success: false, error: String(err) };
  }
});
/**
 * Capture the game/video window directly (rather than the whole screen).
 * kind: 'valorant' (window titled "VALORANT") or 'video' (a video player).
 * This keeps the kill-feed scan region on the window's own top-right, which is
 * required when the source is a windowed video player — whole-screen capture
 * would scan the wrong area and report "no kill feed in top-right".
 */
ipcMain.handle('screen:snapWindow', async (_, kind = 'video', opts = {}) => {
  try {
    const predicate = kind === 'valorant' ? isValorantWindow : isVideoViewerWindow;
    const res = await captureWindowByName(predicate, opts);
    return res;
  } catch (err) {
    console.error('[SnapWindow] capture error:', err);
    return { success: false, error: String(err) };
  }
});
/** Check if Valorant window is currently open */
ipcMain.handle('screen:isValorantOpen', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: 1, height: 1 }
    });
    const found = sources.some((s) => isValorantWindow(s.name));
    return { success: true, isOpen: found };
  } catch (err) {
    return { success: false, error: String(err), isOpen: false };
  }
});

/** Check if a video viewer window (demo playback source) is currently open */
ipcMain.handle('screen:isVideoViewerOpen', async () => {
  try {
    const found = await findWindowSource(isVideoViewerWindow);
    return {
      success: true,
      isOpen: !!found,
      screenIndex: found ? found.screenIndex : null,
    };
  } catch (err) {
    return { success: false, error: String(err), isOpen: false, screenIndex: null };
  }
});

// ── ONNX Model IPC ────────────────────────────────────────────────

ipcMain.handle('model:load', async () => {
  try {
    const info = await modelService.loadModels();
    return { success: true, ...info };
  } catch (err) {
    console.error('[Model] load error:', err);
    return { success: false, error: String(err) };
  }
});

/**
 * Detect a flaw by running the model on a flawed + flawless clip pair.
 * payload: { flawedFrames: number[][], flawlessFrames: number[][] }
 *   each frame is 224*224*3 normalized RGB floats (0-1).
 */
ipcMain.handle('model:detectFlaw', async (_, payload) => {
  try {
    const result = await modelService.detectFlaw(payload.flawedFrames, payload.flawlessFrames);
    return { success: true, ...result };
  } catch (err) {
    console.error('[Model] detect error:', err);
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('model:metadata', () => {
  return { success: true, metadata: modelService.getMetadata(), flawTypes: modelService.getFlawTypes() };
});

// ── OCR IPC (kill-feed nameplate confirmation) ───────────────────

let _ocrWorker = null;
let _ocrWorkerPromise = null;

async function getOcrWorker() {
  if (_ocrWorker) return _ocrWorker;
  if (!_ocrWorkerPromise) {
    _ocrWorkerPromise = createWorker('eng')
      .then((w) => { _ocrWorker = w; return w; })
      .catch((err) => { _ocrWorkerPromise = null; throw err; });
  }
  return _ocrWorkerPromise;
}

ipcMain.handle('ocr:recognize', async (_, dataUrl) => {
  try {
    if (!dataUrl || typeof dataUrl !== 'string') {
      return { success: false, error: 'No image data provided' };
    }
    const worker = await getOcrWorker();
    const { data } = await worker.recognize(dataUrl);
    return {
      success: true,
      text: (data && data.text) || '',
      confidence: (data && data.confidence) || 0,
    };
  } catch (err) {
    console.error('[OCR] recognize error:', err);
    return { success: false, error: String((err && err.message) || err) };
  }
});

// ── Hotkey update IPC ─────────────────────────────────────────────

ipcMain.handle('hotkeys:update', (_, { toggle, manualTag }) => {
  registerShortcuts(toggle, manualTag);
  return { success: true };
});

// ── App lifecycle ──────────────────────────────────────────────────

app.whenReady().then(() => {
  createDesktopWindow();
  createOverlayWindow();
  createTray();
  registerShortcuts('CommandOrControl+Shift+A', 'CommandOrControl+Shift+D');

  app.on('activate', () => {
    if (desktopWindow) desktopWindow.show();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.isQuitting = false;
