import {
  WINDOW_NAMES,
  SUPPORTED_GAME_IDS,
  GAME_DISPLAY_NAMES,
  GAME_FEATURES,
  MOCK_MODE,
  HOTKEY_MOCK_DEATH,
  DEATH_AUTOPSY_EVENT,
  AUTOPSY_TAGGED_EVENT,
  AUTOPSY_SKIPPED_EVENT,
  MATCH_AUTOPSY_SUMMARY_EVENT,
  OVERLAY_FORCE_DISMISS_EVENT,
  DEATH_AUTOPSY_COOLDOWN_MS,
  VALORANT_CLASS_ID
} from '../../scripts/constants.js';
import { EventBus } from '../../scripts/services/event-bus.js';
import { AutopsyStore } from '../../scripts/services/autopsy-store.js';

const IS_ELECTRON = typeof window !== 'undefined' && window.electronAPI?.isElectron;

function normalizeOutcome(value) {
  if (value == null || value === '') return null;
  const raw = String(value).toLowerCase().trim();
  if (!raw) return null;
  if (raw.includes('victor') || raw === 'win' || raw === 'won') return 'victory';
  if (raw.includes('defeat') || raw === 'loss' || raw === 'lose' || raw === 'lost') {
    return 'defeat';
  }
  if (raw.includes('draw') || raw === 'tie') return 'draw';
  return raw;
}

class BackgroundController {
  constructor() {
    this.eventBus = new EventBus();
    this.autopsyStore = new AutopsyStore();
    this._mockMatchId = `mock-${Date.now().toString(36)}`;
    this._mockRound = 1;
    this._mockSide = 'attack';
    this._mockDeaths = 0;
    this._matchContext = this._emptyMatchContext();
    this._summaryMatchId = null;
    this._overlaySessionOpen = false;
    this._lastDeathAt = 0;
    this._lastDeathKey = null;
  }

  _emptyMatchContext() {
    return {
      matchId: null,
      round: null,
      side: null,
      score: null,
      deaths: null,
      outcome: null,
      roundPhase: null
    };
  }

  async run() {
    window.owEventBus = this.eventBus;
    window.autopsyStore = this.autopsyStore;
    window.simulateDeathAutopsy = () => this.simulateDeathAutopsy();
    window.endMockMatch = () => this.endMockMatch();
    window.MOCK_MODE = MOCK_MODE;

    this._wireAutopsyPersistence();

    if (IS_ELECTRON) {
      this._registerElectronHotkeys();

    } else {
      // Overwolf mode — register GEP / launch events
      this._registerOverwolfHotkeys();

    }


  }

  _wireAutopsyPersistence() {
    this.eventBus.on(AUTOPSY_TAGGED_EVENT, (payload) => {
      this._overlaySessionOpen = false;
      this._lastDeathAt = Date.now();
      const entry = this.autopsyStore.save({
        matchId: payload?.matchId ?? null,
        round: payload?.round ?? null,
        side: payload?.side ?? null,
        cause: payload?.cause ?? null,
        timestamp: payload?.timestamp || Date.now(),
        skipped: false
      });
      this.eventBus.trigger('autopsy-saved', entry);

    });

    this.eventBus.on(AUTOPSY_SKIPPED_EVENT, (payload) => {
      this._overlaySessionOpen = false;
      this._lastDeathAt = Date.now();
      const entry = this.autopsyStore.save({
        matchId: payload?.matchId ?? null,
        round: payload?.round ?? null,
        side: payload?.side ?? null,
        cause: null,
        timestamp: payload?.timestamp || Date.now(),
        skipped: true
      });
      this.eventBus.trigger('autopsy-saved', entry);

    });
  }

  _deathKey(payload) {
    return [
      payload?.matchId ?? '',
      payload?.round ?? '',
      payload?.deaths ?? '',
      payload?.source ?? ''
    ].join('|');
  }

  _shouldIgnoreDeath(payload) {
    const now = Date.now();
    const key = this._deathKey(payload);

    if (this._overlaySessionOpen) {

      return true;
    }

    if (
      this._lastDeathKey === key &&
      now - this._lastDeathAt < DEATH_AUTOPSY_COOLDOWN_MS
    ) {

      return true;
    }

    if (now - this._lastDeathAt < DEATH_AUTOPSY_COOLDOWN_MS && this._lastDeathAt > 0) {

      return true;
    }

    return false;
  }

  async handleDeathAutopsy(payload) {
    if (this._shouldIgnoreDeath(payload)) {
      return null;
    }

    const event = {
      matchId: payload.matchId ?? null,
      round: payload.round ?? null,
      side: payload.side ?? null,
      score: payload.score ?? null,
      deaths: payload.deaths ?? null,
      source: payload.source || 'unknown',
      timestamp: payload.timestamp || Date.now()
    };

    this._overlaySessionOpen = true;
    this._lastDeathAt = event.timestamp;
    this._lastDeathKey = this._deathKey(event);


    this.eventBus.trigger(DEATH_AUTOPSY_EVENT, event);

    // Show overlay window
    if (IS_ELECTRON) {
      // Send death data to overlay via IPC
      window.electronAPI.sendDeathEvent(event);
      window.electronAPI.showOverlay();
    } else {
      const { WindowsService } = await import('../../scripts/services/windows-service.js');
      await WindowsService.obtain(WINDOW_NAMES.IN_GAME);
      await WindowsService.restore(WINDOW_NAMES.IN_GAME);
    }

    return event;
  }

  /** Hide overlay if still up when the next round starts */
  async dismissOverlayForNewRound(reason) {
    if (!this._overlaySessionOpen) {
      if (IS_ELECTRON) {
        window.electronAPI.hideOverlay();
      } else {
        const { WindowsService } = await import('../../scripts/services/windows-service.js');
        await WindowsService.hide(WINDOW_NAMES.IN_GAME);
      }
      return;
    }


    this.eventBus.trigger(OVERLAY_FORCE_DISMISS_EVENT, {
      reason,
      timestamp: Date.now()
    });

    if (IS_ELECTRON) {
      window.electronAPI.hideOverlay();
    } else {
      const { WindowsService } = await import('../../scripts/services/windows-service.js');
      await WindowsService.hide(WINDOW_NAMES.IN_GAME);
    }
  }

  simulateDeathAutopsy() {
    if (!MOCK_MODE) {
      console.warn('[Leakling] simulateDeathAutopsy ignored — MOCK_MODE is false');
      return Promise.resolve(null);
    }

    this._mockDeaths += 1;
    const payload = {
      matchId: this._mockMatchId,
      round: this._mockRound,
      side: this._mockSide,
      score: {
        won: Math.max(0, this._mockRound - this._mockDeaths),
        lost: Math.max(0, this._mockDeaths - 1)
      },
      deaths: this._mockDeaths,
      source: 'mock',
      timestamp: Date.now()
    };

    this._mockRound += 1;
    if (this._mockRound % 2 === 1) {
      this._mockSide = this._mockSide === 'attack' ? 'defense' : 'attack';
    }

    return this.handleDeathAutopsy(payload);
  }

  endMockMatch(outcome = 'defeat') {
    if (!MOCK_MODE) {
      console.warn('[Leakling] endMockMatch ignored — MOCK_MODE is false');
      return null;
    }

    const matchId = this._mockMatchId;
    const summary = this.publishMatchAutopsySummary({
      matchId,
      outcome: normalizeOutcome(outcome) || 'defeat',
      source: 'mock'
    });

    this._mockMatchId = `mock-${Date.now().toString(36)}`;
    this._mockRound = 1;
    this._mockSide = 'attack';
    this._mockDeaths = 0;
    this._summaryMatchId = null;

    return summary;
  }

  publishMatchAutopsySummary({ matchId = null, outcome = null, source = 'unknown' } = {}) {
    const resolvedMatchId = matchId || this._matchContext.matchId || null;

    if (resolvedMatchId && this._summaryMatchId === resolvedMatchId) {

      return null;
    }

    const entries = resolvedMatchId
      ? this.autopsyStore.listByMatch(resolvedMatchId)
      : this.autopsyStore.listRecent(50);

    const tagged = entries.filter((e) => e && !e.skipped && e.cause);
    const topCauses = this.autopsyStore.getTopCauses(3, tagged);
    const suggestedFocus = topCauses[0]?.cause || null;

    if (suggestedFocus) {
      this.autopsyStore.setFocusGoal(suggestedFocus);
    }

    const summary = {
      matchId: resolvedMatchId,
      outcome: outcome || this._matchContext.outcome || null,
      score: this._matchContext.score || null,
      taggedCount: tagged.length,
      skippedCount: entries.filter((e) => e && e.skipped).length,
      topCauses,
      suggestedFocus,
      source,
      timestamp: Date.now()
    };

    if (resolvedMatchId) {
      this._summaryMatchId = resolvedMatchId;
    }

    this.eventBus.trigger(MATCH_AUTOPSY_SUMMARY_EVENT, summary);

    return summary;
  }

  _registerElectronHotkeys() {
    if (!window.electronAPI) return;

    // Hotkey from main process
    window.electronAPI.onHotkey((name) => {
      if (name === 'autopsy_mock_death') {
        this.simulateDeathAutopsy();
      }
    });

    // Tag events from overlay IPC
    window.electronAPI.onTagEvent((tagData) => {
      this._overlaySessionOpen = false;
      this._lastDeathAt = Date.now();
      const entry = this.autopsyStore.save({
        matchId: tagData.matchId ?? null,
        round: tagData.round ?? null,
        side: tagData.side ?? null,
        cause: tagData.cause ?? null,
        timestamp: tagData.timestamp || Date.now(),
        skipped: false
      });
      this.eventBus.trigger('autopsy-saved', entry);

    });

    // Skip events from overlay IPC
    window.electronAPI.onSkipEvent((skipData) => {
      this._overlaySessionOpen = false;
      this._lastDeathAt = Date.now();
      const entry = this.autopsyStore.save({
        matchId: skipData.matchId ?? null,
        round: skipData.round ?? null,
        side: skipData.side ?? null,
        cause: null,
        timestamp: skipData.timestamp || Date.now(),
        skipped: true
      });
      this.eventBus.trigger('autopsy-saved', entry);

    });

    // Dismiss events from overlay IPC
    window.electronAPI.onDismissEvent((dismissData) => {
      this.eventBus.trigger(OVERLAY_FORCE_DISMISS_EVENT, dismissData);
    });
  }

  _registerOverwolfHotkeys() {
    overwolf.settings.hotkeys.onPressed.addListener((e) => {
      if (!e || e.name !== HOTKEY_MOCK_DEATH) return;
      this.simulateDeathAutopsy();
    });

    overwolf.extensions.onAppLaunchTriggered.addListener((e) => {
      if (e && e.source !== 'gamelaunchevent') {
        // Restore desktop if launched from taskbar
      }
    });
  }
}

const controller = new BackgroundController();
controller.run().catch((err) => console.error('[Leakling][Background]', err));
