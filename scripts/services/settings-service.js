const STORAGE_KEY = 'leakling_settings_v1';

const DEFAULTS = {
  overlayOn: true,
  overlayPosition: 'Top right',
  overlayOpacity: 75,
  toggleHotkey: 'Ctrl+Shift+A',
  tagHotkey: 'Ctrl+Shift+D',
  mockOn: false,
  playerName: '',
  autoStart: false,
  theme: 'default',
  snapOn: false,
  detectionMode: 'Auto',
};

export class SettingsService {
  constructor() {
    this._settings = { ...DEFAULTS };
    this._load();
  }

  get(key) {
    return this._settings[key];
  }

  getAll() {
    return { ...this._settings };
  }

  set(key, value) {
    this._settings[key] = value;
    this._persist();
  }

  setAll(partial) {
    Object.assign(this._settings, partial);
    this._persist();
  }

  reset() {
    this._settings = { ...DEFAULTS };
    this._persist();
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data && typeof data === 'object') {
        // Merge with defaults so new keys always have a value
        this._settings = { ...DEFAULTS, ...data };
      }
    } catch (err) {
      console.warn('[SettingsService] load failed', err);
      this._settings = { ...DEFAULTS };
    }
  }

  _persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._settings));
    } catch (err) {
      console.warn('[SettingsService] persist failed', err);
    }
  }
}
