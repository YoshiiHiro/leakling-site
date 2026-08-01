const STORAGE_KEY = 'leakling_v1';
const RECENT_LIMIT = 50;

function makeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `autopsy-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export class AutopsyStore {
  constructor() {
    this._entries = [];
    this._focusGoal = null;
    this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      this._entries = Array.isArray(data.entries) ? data.entries : [];
      this._focusGoal = data.focusGoal ?? null;
    } catch (err) {
      console.warn('[AutopsyStore] load failed', err);
      this._entries = [];
      this._focusGoal = null;
    }
  }

  _persist() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          entries: this._entries,
          focusGoal: this._focusGoal
        })
      );
    } catch (err) {
      console.warn('[AutopsyStore] persist failed', err);
    }
  }

  /**
   * @param {{ matchId?, round?, score?, side?, cause?, timestamp?, skipped? }} partial
   */
  save(partial = {}) {
    const cause = partial.skipped ? null : partial.cause ?? null;
    const timestamp = partial.timestamp || Date.now();

    // Dedup: skip if same cause added within the last 5 seconds
    const last = this._entries[0];
    if (last && !last.skipped && cause && last.cause === cause && (timestamp - last.timestamp) < 5000) {
      return last;
    }

    const entry = {
      id: makeId(),
      matchId: partial.matchId ?? null,
      round: partial.round ?? null,
      score: partial.score ?? null,
      side: partial.side ?? null,
      cause,
      timestamp,
      skipped: Boolean(partial.skipped)
    };

    this._entries.unshift(entry);
    if (this._entries.length > 500) {
      this._entries.length = 500;
    }
    this._persist();
    return entry;
  }

  listByMatch(matchId) {
    if (matchId == null) return [];
    return this._entries.filter((e) => e.matchId === matchId);
  }

  listRecent(limit = RECENT_LIMIT) {
    return this._entries.slice(0, Math.max(0, limit));
  }

  aggregateCauseCounts(entries = this._entries) {
    const counts = {};
    entries.forEach((entry) => {
      if (!entry || entry.skipped || !entry.cause) return;
      counts[entry.cause] = (counts[entry.cause] || 0) + 1;
    });
    return counts;
  }

  getTopCauses(n = 3, entries = this._entries) {
    const counts = this.aggregateCauseCounts(entries);
    return Object.entries(counts)
      .map(([cause, count]) => ({ cause, count }))
      .sort((a, b) => b.count - a.count || a.cause.localeCompare(b.cause))
      .slice(0, Math.max(0, n));
  }

  setFocusGoal(cause) {
    this._focusGoal = cause || null;
    this._persist();
    return this._focusGoal;
  }

  getFocusGoal() {
    return this._focusGoal;
  }

  getAll() {
    return [...this._entries];
  }

  clearAll() {
    this._entries = [];
    this._focusGoal = null;
    this._persist();
  }
}
