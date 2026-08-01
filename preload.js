const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Window management ──────────────────────────────────────────

  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  hideToTray: () => ipcRenderer.invoke('window:hideToTray'),
  showFromTray: () => ipcRenderer.invoke('window:showFromTray'),
  resizeToContent: (contentHeight) => ipcRenderer.invoke('window:resizeToContent', contentHeight),

  // ── Overlay (in-game) window ───────────────────────────────────

  showOverlay: (opts) => ipcRenderer.invoke('overlay:show', opts || {}),
  hideOverlay: () => ipcRenderer.invoke('overlay:hide'),
  setOverlayOpacity: (opacity) => ipcRenderer.invoke('overlay:setOpacity', opacity),
  setOverlayPosition: (pos) => ipcRenderer.invoke('overlay:setPosition', pos),

  // Send death event from desktop to overlay
  sendDeathEvent: (deathData) => {
    ipcRenderer.send('overlay:sendDeathEvent', deathData);
  },

  // Send tag from overlay back to desktop
  sendTagEvent: (tagData) => {
    ipcRenderer.send('overlay:sendTagEvent', tagData);
  },

  // Send skip from overlay back to desktop
  sendSkipEvent: (skipData) => {
    ipcRenderer.send('overlay:sendSkipEvent', skipData);
  },

  // Send dismiss from overlay back to desktop
  sendDismissEvent: (dismissData) => {
    ipcRenderer.send('overlay:sendDismissEvent', dismissData);
  },

  // Notify desktop that overlay is ready
  sendOverlayReady: () => {
    ipcRenderer.send('overlay:ready');
  },

  // ── Receive events from main process ───────────────────────────

  // Listen for death event (overlay receives this)
  onDeathEvent: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('overlay:deathEvent', handler);
    return () => ipcRenderer.removeListener('overlay:deathEvent', handler);
  },

  // Listen for tag events from overlay (desktop receives)
  onTagEvent: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('overlay:tagEvent', handler);
    return () => ipcRenderer.removeListener('overlay:tagEvent', handler);
  },

  // Listen for skip events from overlay
  onSkipEvent: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('overlay:skipEvent', handler);
    return () => ipcRenderer.removeListener('overlay:skipEvent', handler);
  },

  // Listen for dismiss events from overlay
  onDismissEvent: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('overlay:dismissEvent', handler);
    return () => ipcRenderer.removeListener('overlay:dismissEvent', handler);
  },

  // Listen for overlay ready signal
  onOverlayReady: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('overlay:ready', handler);
    return () => ipcRenderer.removeListener('overlay:ready', handler);
  },

  // ── Hotkeys from main process ──────────────────────────────────

  onHotkey: (callback) => {
    const handler = (_, name) => callback(name);
    ipcRenderer.on('hotkey', handler);
    return () => ipcRenderer.removeListener('hotkey', handler);
  },

  // ── Screen capture ─────────────────────────────────────────────

  snapScreen: (screenIndex, opts) => ipcRenderer.invoke('screen:snap', screenIndex, opts),
  snapWindow: (kind, opts) => ipcRenderer.invoke('screen:snapWindow', kind, opts),
  detectScreens: () => ipcRenderer.invoke('screen:detect'),
  isValorantOpen: () => ipcRenderer.invoke('screen:isValorantOpen'),
  isVideoViewerOpen: () => ipcRenderer.invoke('screen:isVideoViewerOpen'),

  // ── OCR (kill-feed nameplate confirmation) ─────────────────────

  ocrRecognize: (dataUrl) => ipcRenderer.invoke('ocr:recognize', dataUrl),

  // ── ONNX model ─────────────────────────────────────────────────

  loadModel: () => ipcRenderer.invoke('model:load'),
  detectFlaw: (payload) => ipcRenderer.invoke('model:detectFlaw', payload),
  getModelMetadata: () => ipcRenderer.invoke('model:metadata'),

  // ── Hotkey configuration ────────────────────────────────────────

  updateHotkeys: (hotkeys) => ipcRenderer.invoke('hotkeys:update', hotkeys),

  // ── Crash logging ───────────────────────────────────────────────

  crashLog: (data) => ipcRenderer.send('crash:log', data),

  // ── Flag ───────────────────────────────────────────────────────

  isElectron: true
});

// ── Catch renderer-side errors and forward to main crash log ──────

window.addEventListener('error', (event) => {
  try {
    ipcRenderer.send('crash:log', {
      type: 'renderer_uncaught',
      source: 'desktop',
      message: event.message || String(event.error),
      stack: event.error?.stack || null,
      url: event.filename || null,
      line: event.lineno || null,
      col: event.colno || null,
    });
  } catch {}
});

window.addEventListener('unhandledrejection', (event) => {
  try {
    ipcRenderer.send('crash:log', {
      type: 'renderer_unhandled_rejection',
      source: 'desktop',
      message: event.reason?.message || String(event.reason),
      stack: event.reason?.stack || null,
    });
  } catch {}
});
