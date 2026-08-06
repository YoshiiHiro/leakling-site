/**
 * DeathDetector — simulates visual recognition of player death by scanning
 * the top‑right kill feed and parsing the kill‑feed entry layout.
 *
 * Valorant kill feed entry structure (top‑right corner):
 *
 *   ┌──────────────┬────┬──────────────┐
 *   │  🔴 RED bg   │ 🔫 │  🟢 GREEN bg │
 *   │   (killer)   │icon│   (victim)   │
 *   └──────────────┴────┴──────────────┘
 *                                  ← yellow edge (if YOU are the victim)
 *
 *   - LEFT side  = RED background   = the killer
 *   - RIGHT side = GREEN background = the victim
 *   - Weapon icon sits in the middle
 *   - When YOU die, the RIGHT (green victim) side has a yellow right‑edge highlight
 *   - When YOU kill someone, your name is on the LEFT (red killer) side — no yellow edge
 *   - When a teammate kills/dies with no player involvement → both sides visible, no yellow
 *   - During spectate: yellow edge belongs to the spectated player, not you
 *
 * In production this would use screen‑capture + pixel sampling.
 * In mock mode it simulates the pipeline.
 */

export type DetectionState =
  | 'idle'               // Not looking for anything
  | 'scanning'           // Actively scanning the kill feed region
  | 'death_confirmed'    // Green (victim) side has yellow right‑edge = your death
  | 'my_kill'            // Your name on red (killer) side = you got a kill
  | 'spectate_rejected'  // Yellow edge found but spectate HUD is active
  | 'low_confidence'     // Kill feed visible but no yellow edge = ally fight
  | 'error';             // Capture failed

export interface KillFeedEntry {
  /** Left half: RED background = killer */
  killerName: string;
  /** Right half: GREEN background = victim */
  victimName: string;
  /** Whether the right (victim) edge has the yellow death highlight */
  hasYellowEdge: boolean;
}

export interface DetectionResult {
  state: DetectionState;
  confidence: number;              // 0–1
  frameTimeMs: number;             // simulated processing time
  detail: string;                  // what the detector "saw"
  entries?: KillFeedEntry[];       // parsed kill feed entries (up to 5)
  spectateWarning?: string;        // set when spectate mode is suspected
  error?: string;                  // set on error
  /** Detected score from top-center HUD, e.g. "3 - 5" */
  score?: string;
}

export type DetectionScenario = 'death' | 'my_kill' | 'ally_fight' | 'spectate' | 'no_feed' | 'error';

const SCENARIOS: Record<DetectionScenario, DetectionResult> = {
  death: {
    state: 'death_confirmed',
    confidence: 0.96,
    frameTimeMs: 34,
    detail: 'Red/green kill entry: RIGHT (green) side has yellow edge → your death.',
    entries: [
      { killerName: 'EnemyPhoenix', victimName: 'You', hasYellowEdge: true },
    ],
  },
  my_kill: {
    state: 'my_kill',
    confidence: 0.89,
    frameTimeMs: 30,
    detail: 'Red/green kill entry: LEFT (red) side is you → you killed someone.',
    entries: [
      { killerName: 'You', victimName: 'EnemyJett', hasYellowEdge: false },
    ],
  },
  ally_fight: {
    state: 'low_confidence',
    confidence: 0.42,
    frameTimeMs: 28,
    detail: 'Red/green kill entry visible but no yellow edge — a teammate or enemy died, not you.',
    entries: [
      { killerName: 'TeammateSage', victimName: 'EnemyRaze', hasYellowEdge: false },
    ],
  },
  spectate: {
    state: 'spectate_rejected',
    confidence: 0.91,
    frameTimeMs: 41,
    detail: 'Red/green entry with yellow edge BUT spectate HUD overlay active — belongs to spectated player.',
    entries: [
      { killerName: 'EnemyOmen', victimName: 'SpectatedPlayer', hasYellowEdge: true },
    ],
    spectateWarning: 'Spectate HUD detected. Yellow edge is NOT yours — suppressing overlay.',
  },
  no_feed: {
    state: 'low_confidence',
    confidence: 0.08,
    frameTimeMs: 18,
    detail: 'No red/green kill feed entries detected in top‑left region.',
  },
  error: {
    state: 'error',
    confidence: 0,
    frameTimeMs: 0,
    detail: 'Frame capture failed',
    error: 'Could not capture game window. Is Valorant running in fullscreen?',
  },
};

/**
 * Forgiving match of OCR'd nameplate text against the player's name.
 * Normalizes both, tries exact containment, then any 4-char substring of the
 * player name (tolerates OCR misreads on small stylized game text).
 */
function fuzzyNameMatch(ocrText: string, playerName: string): boolean {
  const t = ocrText.toLowerCase().replace(/[^a-z0-9]/g, '');
  const p = playerName.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!t || !p) return false;
  if (t.includes(p) || p.includes(t)) return true;
  if (p.length >= 4) {
    for (let i = 0; i <= p.length - 4; i++) {
      if (t.includes(p.slice(i, i + 4))) return true;
    }
  }
  return false;
}

// Higher-res capture so the strict kill-feed / gold-strip detector has enough
// pixels (matches the demo panel's capture resolution).
const SNAP_CAPTURE_WIDTH = 960;
const SNAP_CAPTURE_HEIGHT = 540;

export class DeathDetector {
  private _state: DetectionState = 'idle';
  private _lastResult: DetectionResult | null = null;
  private _scanInterval: ReturnType<typeof setInterval> | null = null;
  private _onResult: ((r: DetectionResult) => void) | null = null;
  private _onAutoDetect: ((r: DetectionResult) => void) | null = null;
  private _history: DetectionResult[] = [];
  private _consecutiveDeaths = 0;
  private _consecutiveSpectates = 0;
  private _consecutiveKills = 0;
  private _feedEntriesSeen = 0;

  get state() { return this._state; }
  get lastResult() { return this._lastResult; }
  get history() { return [...this._history]; }

  onResult(cb: (r: DetectionResult) => void) {
    this._onResult = cb;
  }

  onAutoDetect(cb: (r: DetectionResult) => void) {
    this._onAutoDetect = cb;
  }

  startScanning(intervalMs = 3000) {
    if (this._scanInterval) return;
    this._state = 'scanning';
    this._scanInterval = setInterval(() => {
      // Production: capture top-left, find red/green blocks, check right-edge hue
    }, intervalMs);
  }

  stopScanning() {
    if (this._scanInterval) {
      clearInterval(this._scanInterval);
      this._scanInterval = null;
    }
    this._state = 'idle';
  }

  /**
   * Simulate a detection scan. In production this would:
   *   1. Capture the top‑left 400×500 region
   *   2. Find rectangular blocks with RED left half / GREEN right half
   *   3. For each block, sample the right‑edge pixels
   *   4. If hue ≈ 45° (yellow) → death edge found
   *   5. Check for spectate observation bar at top‑center
   */
  detect(scenario: DetectionScenario = 'death'): DetectionResult {
    const result = { ...SCENARIOS[scenario] };
    result.entries = result.entries ? [...result.entries] : undefined;

    // Add jitter
    if (scenario === 'death' || scenario === 'my_kill') {
      const jitter = Math.round((Math.random() * 6 - 3) * 100) / 10000;
      result.confidence = Math.min(1, Math.max(0, result.confidence + jitter));
    }

    if (result.entries) this._feedEntriesSeen += result.entries.length;

    this._lastResult = result;
    this._state = result.state;
    this._history = [...this._history.slice(-7), result];

    if (result.state === 'death_confirmed') {
      this._consecutiveDeaths++;
      this._consecutiveSpectates = 0;
      this._consecutiveKills = 0;
    } else if (result.state === 'spectate_rejected') {
      this._consecutiveSpectates++;
      this._consecutiveDeaths = 0;
      this._consecutiveKills = 0;
    } else if (result.state === 'my_kill') {
      this._consecutiveKills++;
      this._consecutiveDeaths = 0;
      this._consecutiveSpectates = 0;
    } else {
      this._consecutiveDeaths = 0;
      this._consecutiveSpectates = 0;
      this._consecutiveKills = 0;
    }

    this._onResult?.(result);
    return result;
  }

  detectAuto(): DetectionResult {
    return this.detect('death');
  }

  // ── 60fps Frame Capture ─────────────────────────────────────────
  // Lightweight capture pipeline: captures at ~60fps, analyzes each frame
  // for death detection, then discards immediately. No persistent storage.
  // Exposes latestFrame for external AI project consumption.

  private _snapTimer: ReturnType<typeof setInterval> | null = null;
  private _snapActive = false;
  private _snapBusy = false;
  private _snapCanvas: HTMLCanvasElement | null = null;
  private _snapCtx: CanvasRenderingContext2D | null = null;
  private _frameCount = 0;
  private _startTime = 0;
  private _captureStats = { captured: 0, dropped: 0 };
  /** Latest raw frame data — exposed for external AI project consumption */
  private _latestFrame: { dataUrl: string; width: number; height: number; takenAt: number } | null = null;
  /** Which screen index to capture from (0 = primary) */
  private _targetScreenIndex = 0;
  /** Capture mode for the auto-snap loop: 'window' (game/video window) or 'screen' */
  private _captureMode: 'window' | 'screen' = 'screen';
  /** Which window predicate to capture when mode === 'window' */
  private _windowKind: 'valorant' | 'video' | null = null;
  /** Auto-detect watcher */
  private _valorantWatchTimer: ReturnType<typeof setInterval> | null = null;
  private _valorantWasOpen = false;
  /** Callback fired when auto-detect state changes */
  private _onValorantState: ((isOpen: boolean) => void) | null = null;
  /** Player's in-game name — used to OCR-confirm death/kill nameplates */
  private _playerName = '';

  get snapshotCount() { return this._frameCount; }
  get isSnapping() { return this._snapActive; }
  get targetScreenIndex() { return this._targetScreenIndex; }
  get isValorantOpen() { return this._valorantWasOpen; }

  /** Register a callback for Valorant open/close state changes */
  onValorantState(cb: (isOpen: boolean) => void) {
    this._onValorantState = cb;
  }

  /** Start polling for Valorant process and auto-toggle snapping */
  startWatching() {
    if (this._valorantWatchTimer) return;
    this._valorantWatchTimer = setInterval(async () => {
      try {
        const result = await window.electronAPI?.isValorantOpen?.();
        const isOpen = result?.isOpen === true;
        if (isOpen && !this._valorantWasOpen) {
          // Valorant just launched — switch to 60fps
          this._valorantWasOpen = true;
          await this.detectValorantScreen();
          if (this._snapActive) {
            // Restart snapping at higher rate
            this.stopSnapping();
            this.startSnapping();
          } else {
            this.startSnapping();
          }
          this._onValorantState?.(true);
        } else if (!isOpen && this._valorantWasOpen) {
          // Valorant just closed — throttle to idle
          this._valorantWasOpen = false;
          if (this._snapActive) {
            // Restart snapping at lower rate
            this.stopSnapping();
            this.startSnapping();
          }
          this._onValorantState?.(false);
        }
      } catch {}
    }, 2000);
    // Check immediately on start
    this._checkValorantNow();
  }

  private async _checkValorantNow() {
    try {
      const result = await window.electronAPI?.isValorantOpen?.();
      this._valorantWasOpen = result?.isOpen === true;
    } catch {}
  }

  /** Stop the Valorant watcher */
  stopWatching() {
    if (this._valorantWatchTimer) {
      clearInterval(this._valorantWatchTimer);
      this._valorantWatchTimer = null;
    }
  }

  /**
   * Detect which display has the Valorant window open.
   * Returns the screen index (0 = primary, 1 = secondary, etc.)
   * Falls back to 0 if Valorant isn't found.
   */
  async detectValorantScreen(): Promise<number> {
    try {
      const result = await window.electronAPI?.detectScreens?.();
      if (result?.success) {
        if (result.valorantFound && result.valorantScreenIndex != null) {
          this._targetScreenIndex = result.valorantScreenIndex;
          this._captureMode = 'window';
          this._windowKind = 'valorant';
        } else if (result.videoViewerFound && result.videoViewerScreenIndex != null) {
          this._targetScreenIndex = result.videoViewerScreenIndex;
          this._captureMode = 'window';
          this._windowKind = 'video';
        } else {
          this._captureMode = 'screen';
          this._windowKind = null;
        }
      }
    } catch {}
    return this._targetScreenIndex;
  }

  /** Set the target screen index manually */
  setTargetScreen(index: number) {
    this._targetScreenIndex = Math.max(0, index);
  }

  /** Set the player's in-game name for OCR nameplate confirmation ('' = disabled) */
  setPlayerName(name: string) {
    this._playerName = (name || '').trim();
  }
  /** Performance stats for diagnostics — fps computed live from elapsed time */
  get captureStats() {
    const elapsed = this._startTime ? (performance.now() - this._startTime) / 1000 : 0;
    const fps = elapsed > 0.5 ? Math.round(this._captureStats.captured / elapsed) : 0;
    return { captured: this._captureStats.captured, dropped: this._captureStats.dropped, fps };
  }
  /** Get the latest frame for external AI processing — returns null if not snapping */
  get latestFrame() { return this._latestFrame; }

  /** Start the snapshot loop — 60fps only when a live source is detected. */
  startSnapping(forceHighPerf = false) {
    if (this._snapTimer || this._snapActive) return;
    this._snapActive = true;
    this._snapBusy = false;
    this._frameCount = 0;
    this._startTime = performance.now();
    this._captureStats = { captured: 0, dropped: 0 };
    // 60fps only if Valorant is running, a window source (Valorant/video) was
    // detected, or high-perf was explicitly requested. Otherwise idle at 1fps
    // so the app stays responsive when nothing is on screen.
    const useHighPerf = forceHighPerf || this._valorantWasOpen || this._captureMode === 'window';
    const interval = useHighPerf ? 16 : 1000;
    // Take first snap immediately
    this._takeSnap();
    this._snapTimer = setInterval(() => {
      if (!this._snapBusy) this._takeSnap();
    }, interval);
  }

  stopSnapping() {
    this._snapActive = false;
    this._latestFrame = null;
    if (this._snapTimer) {
      clearInterval(this._snapTimer);
      this._snapTimer = null;
    }
  }

  /** Capture one frame, preferring the game/video window's own top-right. */
  private async _captureFrame(): Promise<{ success: boolean; dataUrl?: string; width?: number; height?: number; error?: string }> {
    if (this._captureMode === 'window' && this._windowKind && window.electronAPI?.snapWindow) {
      try {
        const res = await window.electronAPI.snapWindow(this._windowKind, { width: SNAP_CAPTURE_WIDTH, height: SNAP_CAPTURE_HEIGHT });
        if (res?.success && res.dataUrl) return { success: true, dataUrl: res.dataUrl };
      } catch {}
      // fall through to whole-screen capture below
    }
    if (window.electronAPI?.snapScreen) {
      const res = await window.electronAPI.snapScreen(this._targetScreenIndex, { width: SNAP_CAPTURE_WIDTH, height: SNAP_CAPTURE_HEIGHT });
      if (res?.success && res.dataUrl) return { success: true, dataUrl: res.dataUrl };
      return { success: false, error: res?.error || 'Capture failed' };
    }
    return { success: false, error: 'No capture API' };
  }

  private async _takeSnap() {
    if (!window.electronAPI?.snapScreen && !window.electronAPI?.snapWindow) {
      console.warn('[Snap] no capture API available');
      return;
    }
    if (this._snapBusy) { this._captureStats.dropped++; return; }
    this._snapBusy = true;
    try {
      const result = await this._captureFrame();
      if (!result.success || !result.dataUrl) {
        this._snapBusy = false;
        return;
      }

      this._captureStats.captured++;
      this._frameCount++;

      // Expose raw frame for external AI consumption (future use)
      this._latestFrame = {
        dataUrl: result.dataUrl,
        width: result.width ?? 0,
        height: result.height ?? 0,
        takenAt: Date.now(),
      };

      // Auto-analyze this new snapshot. `_snapBusy` stays true until this
      // finishes so analyses never overlap and saturate the main thread.
      const detection = await this._analyzeImage(result.dataUrl, this._snapCanvas, this._snapCtx);

      this._lastResult = detection;
      this._state = detection.state;

      this._history.push(detection);
      if (this._history.length > 8) this._history.shift();

      if (detection.state === 'death_confirmed') {
        this._consecutiveDeaths++;
        this._consecutiveSpectates = 0;
        this._consecutiveKills = 0;
        if (this._consecutiveDeaths >= 2 && this._onAutoDetect) {
          this._onAutoDetect(detection);
        }
      } else {
        this._consecutiveDeaths = 0;
      }

      this._onResult?.(detection);
    } catch {
      // ignore
    }
    this._snapBusy = false;
  }

  /** Analyze the latest snapshot for kill feed colors */
  async detectFromSnapshots(): Promise<DetectionResult> {
    if (!this._latestFrame) {
      return {
        state: 'low_confidence', confidence: 0, frameTimeMs: 0,
        detail: 'No frames captured yet. Start snapping first.',
      };
    }

    return this._analyzeImage(this._latestFrame.dataUrl);
  }

  /** Analyze all snapshots and pick the best detection */
  async detectFromAllSnapshots(): Promise<DetectionResult> {
    // In the new lightweight pipeline, we only keep the latest frame.
    // For multi-frame analysis, just re-analyze the latest frame.
    return this.detectFromSnapshots();
  }

  /**
   * Analyze a single frame for a death (kill-feed yellow edge).
   * Public wrapper around _analyzeImage — no state/counter side effects,
   * so callers (e.g. the demo panel's round watcher) can use it independently.
   */
  async analyzeFrame(dataUrl: string): Promise<DetectionResult> {
    return this._analyzeImage(dataUrl);
  }

  private async _analyzeImage(dataUrl: string, reuseCanvas?: HTMLCanvasElement | null, reuseCtx?: CanvasRenderingContext2D | null): Promise<DetectionResult> {
    const startTime = performance.now();

    // Reuse canvas to avoid GC pressure on every snap
    let canvas = reuseCanvas;
    let ctx = reuseCtx;
    if (!canvas || !ctx) {
      canvas = document.createElement('canvas');
      ctx = canvas.getContext('2d')!;
      this._snapCanvas = canvas;
      this._snapCtx = ctx;
    }

    // Load image — use createImageBitmap for faster decode (avoids Image element overhead)
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const img = await createImageBitmap(blob);
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    img.close(); // free the bitmap immediately

    // Kill feed: TOP-RIGHT region (Valorant stacks entries top-right).
    // Each entry is a horizontal bar: [RED killer] [weapon icon] [GREEN victim].
    // The GOLD highlight marks YOUR involvement:
    //   - gold on the LEFT edge of the RED (killer) block = YOUR KILL
    //   - gold on the RIGHT edge of the GREEN (victim) block = YOUR DEATH
    //
    // To avoid mistaking map/HUD gold (site markers, spike icon, ally arrows,
    // round timer, etc.) for a death, we require the gold to be a CONTIGUOUS
    // vertical strip on the exact right boundary of a green kill-feed block,
    // spanning the MAJORITY of the bar's height — not scattered gold pixels.
    const regionW = Math.round(canvas.width * 0.42);
    const regionH = Math.round(canvas.height * 0.32);
    const regionX = canvas.width - regionW;
    const imageData = ctx.getImageData(regionX, 0, regionW, regionH);
    const pixels = imageData.data;

    const step = 2; // sample every 2nd pixel — sharper edge resolution for scaled clips

    // ── Color classifiers (tight) ─────────────────────────────────
    // Red kill-feed block (killer side)
    const isRed = (r: number, g: number, b: number) => r > 120 && g < 115 && b < 115 && r > g * 1.25;
    // Green victim block
    const isGreen = (r: number, g: number, b: number) => g > 100 && r < 150 && b < 130 && g > r * 1.1 && g > b;
    // Gold death/kill edge — warm, saturated yellow. Deliberately excludes
    // white, red, orange and dark pixels so map/HUD gold can't be mistaken
    // for the kill-feed edge.
    const isGold = (r: number, g: number, b: number) =>
      r >= 140 && g >= 100 && b <= 150 && r > g && g > b && (r - b) >= 40 && g > b * 1.2;

    // Phase 1: find kill-feed entry rows — a red run followed by a distinct
    // green run (weapon-icon gap between them).
    const feedRows: Array<{ y: number; redLeft: number; redRight: number; greenLeft: number; greenRight: number }> = [];
    for (let y = 0; y < regionH; y += step) {
      let redLeft = -1, redRight = -1, greenLeft = -1, greenRight = -1;
      let phase: 0 | 1 | 2 = 0; // 0 = before red, 1 = inside red, 2 = inside green
      for (let x = 0; x < regionW; x += step) {
        const i = (y * regionW + x) * 4;
        const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
        if (phase === 0) {
          if (isRed(r, g, b)) { redLeft = x; redRight = x; phase = 1; }
        } else if (phase === 1) {
          if (isRed(r, g, b)) redRight = x;
          else if (isGreen(r, g, b)) { greenLeft = x; greenRight = x; phase = 2; }
        } else if (isGreen(r, g, b)) {
          greenRight = x;
        }
      }
      const redW = redRight - redLeft;
      const greenW = greenRight - greenLeft;
      if (redLeft !== -1 && greenLeft !== -1 && redW >= 6 && greenW >= 6) {
        feedRows.push({ y, redLeft, redRight, greenLeft, greenRight });
      }
    }

    // Phase 2: cluster feed rows into vertical bars (entries), then require a
    // gold strip on the majority of the bar's rows AT the block boundary. This
    // rejects stray map/HUD gold that never forms a full-height edge.
    const entries: Array<{ rows: Array<{ y: number; redLeft: number; redRight: number; greenLeft: number; greenRight: number }> }> = [];
    for (const row of feedRows) {
      const last = entries[entries.length - 1];
      if (last && row.y - last.rows[last.rows.length - 1].y <= step * 3) {
        last.rows.push(row);
      } else {
        entries.push({ rows: [row] });
      }
    }

    let deathConfirmed = false;
    let yellowEdgeScore = 0;
    let killEdgeSeen = false;
    let bestKillEdgeRatio = 0;
    // Best-scoring death/kill entry geometry (for OCR nameplate cropping).
    let bestDeath: { greenLeft: number; greenRight: number; redLeft: number; redRight: number; top: number; bottom: number; ratio: number } | null = null;
    let bestKill: { greenLeft: number; greenRight: number; redLeft: number; redRight: number; top: number; bottom: number; ratio: number } | null = null;

    for (const entry of entries) {
      if (entry.rows.length < 2) continue; // a single stray row is not a kill-feed bar
      const median = (pick: (row: typeof entry.rows[number]) => number) => {
        const arr = entry.rows.map(pick).sort((a, b) => a - b);
        return arr[Math.floor(arr.length / 2)];
      };
      const greenLeft = median((r) => r.greenLeft);
      const greenRight = median((r) => r.greenRight);
      const redLeft = median((r) => r.redLeft);
      const redRight = median((r) => r.redRight);
      const greenWidth = greenRight - greenLeft;
      const redWidth = redRight - redLeft;
      if (greenWidth < 4) continue;

      // Thin gold-edge windows AT the block boundaries + a body control.
      const dEdgeX0 = Math.max(0, greenRight - 1);
      const dEdgeX1 = Math.min(regionW - 1, greenRight + 10);
      const kEdgeX0 = Math.max(0, redLeft - 10);
      const kEdgeX1 = Math.min(regionW - 1, redLeft + 1);
      const bodyX0 = Math.max(0, greenLeft + Math.round(greenWidth * 0.3));
      const bodyX1 = Math.min(regionW - 1, greenRight - Math.round(greenWidth * 0.3));

      let deathVotes = 0, killVotes = 0, rowBestDeath = 0, rowBestKill = 0;
      for (const row of entry.rows) {
        let dGold = 0, dTot = 0, kGold = 0, kTot = 0, bGold = 0, bTot = 0;
        for (let yy = Math.max(0, row.y - step); yy <= Math.min(regionH - 1, row.y + step); yy += step) {
          for (let x = dEdgeX0; x <= dEdgeX1; x += step) {
            const i = (yy * regionW + x) * 4;
            dTot++;
            if (isGold(pixels[i], pixels[i + 1], pixels[i + 2])) dGold++;
          }
          for (let x = kEdgeX0; x <= kEdgeX1; x += step) {
            const i = (yy * regionW + x) * 4;
            kTot++;
            if (isGold(pixels[i], pixels[i + 1], pixels[i + 2])) kGold++;
          }
          for (let x = bodyX0; x <= bodyX1; x += step) {
            const i = (yy * regionW + x) * 4;
            bTot++;
            if (isGold(pixels[i], pixels[i + 1], pixels[i + 2])) bGold++;
          }
        }
        const dRatio = dTot > 0 ? dGold / dTot : 0;
        const kRatio = kTot > 0 ? kGold / kTot : 0;
        const bRatio = bTot > 0 ? bGold / bTot : 0;
        if (dRatio >= 0.25 && dRatio > bRatio * 1.8 && dRatio > kRatio * 1.4) deathVotes++;
        if (kRatio >= 0.25 && kRatio > bRatio * 1.8) killVotes++;
        rowBestDeath = Math.max(rowBestDeath, dRatio);
        rowBestKill = Math.max(rowBestKill, kRatio);
      }

      // A real edge spans most of the bar's height — require majority + ≥2 rows.
      const needed = Math.max(2, Math.ceil(entry.rows.length * 0.5));
      if (deathVotes >= needed) {
        deathConfirmed = true;
        yellowEdgeScore = Math.max(yellowEdgeScore, rowBestDeath);
        if (rowBestDeath > (bestDeath ? bestDeath.ratio : 0)) {
          bestDeath = {
            greenLeft, greenRight, redLeft, redRight,
            top: entry.rows[0].y, bottom: entry.rows[entry.rows.length - 1].y,
            ratio: rowBestDeath,
          };
        }
      }
      if (killVotes >= needed) {
        killEdgeSeen = true;
        bestKillEdgeRatio = Math.max(bestKillEdgeRatio, rowBestKill);
        if (rowBestKill > (bestKill ? bestKill.ratio : 0)) {
          bestKill = {
            greenLeft, greenRight, redLeft, redRight,
            top: entry.rows[0].y, bottom: entry.rows[entry.rows.length - 1].y,
            ratio: rowBestKill,
          };
        }
      }
    }

    const elapsed = Math.round(performance.now() - startTime);

    // Detect score from top-center HUD display
    const score = this._detectScore(ctx, canvas.width, canvas.height);

    // ── Nameplate OCR confirmation ────────────────────────────────
    // Distinguishes a real death/kill (your name on the relevant plate) from
    // stray gold that happens to sit at a block boundary. Only runs when a
    // player name is configured; falls back to the heuristic when OCR is
    // unavailable or the plate text is too short to be reliable.
    if ((deathConfirmed || killEdgeSeen) && this._playerName && window.electronAPI?.ocrRecognize) {
      try {
        if (deathConfirmed && bestDeath) {
          const rec = await this._recognizeNameplate(
            ctx,
            regionX + bestDeath.greenLeft,
            bestDeath.top,
            bestDeath.greenRight - bestDeath.greenLeft,
            bestDeath.bottom - bestDeath.top,
          );
          const plateText = rec ? rec.text.trim() : '';
          const matched = plateText.length >= 3 ? fuzzyNameMatch(plateText, this._playerName) : null;
          if (matched === false) {
            return {
              state: 'low_confidence',
              confidence: 0.2,
              frameTimeMs: elapsed,
              detail: `📸 Snap: gold edge on VICTIM side but nameplate reads "${plateText || '?'}" ≠ "${this._playerName}" — not your death.`,
              entries: [{ killerName: 'KillFeed', victimName: plateText || 'Other', hasYellowEdge: false }],
              score,
            };
          }
          if (matched === true) {
            yellowEdgeScore = Math.min(0.95, yellowEdgeScore + 0.1);
          }
        } else if (killEdgeSeen && bestKill) {
          const rec = await this._recognizeNameplate(
            ctx,
            regionX + bestKill.redLeft,
            bestKill.top,
            bestKill.redRight - bestKill.redLeft,
            bestKill.bottom - bestKill.top,
          );
          const plateText = rec ? rec.text.trim() : '';
          const matched = plateText.length >= 3 ? fuzzyNameMatch(plateText, this._playerName) : null;
          if (matched === false) {
            return {
              state: 'low_confidence',
              confidence: 0.2,
              frameTimeMs: elapsed,
              detail: `📸 Snap: gold edge on KILLER side but nameplate reads "${plateText || '?'}" ≠ "${this._playerName}" — not your kill.`,
              entries: [{ killerName: plateText || 'Other', victimName: 'KillFeed', hasYellowEdge: false }],
              score,
            };
          }
        }
      } catch {}
    }

    if (deathConfirmed) {
      return {
        state: 'death_confirmed',
        confidence: Math.min(0.95, 0.6 + yellowEdgeScore),
        frameTimeMs: elapsed,
        detail: `📸 Snap: gold edge on VICTIM side ${(yellowEdgeScore * 100).toFixed(0)}% — your death confirmed.`,
        entries: [{ killerName: 'KillFeed', victimName: 'You', hasYellowEdge: true }],
        score,
      };
    }

    if (killEdgeSeen) {
      return {
        state: 'my_kill',
        confidence: Math.min(0.75, 0.5 + bestKillEdgeRatio),
        frameTimeMs: elapsed,
        detail: `📸 Snap: gold edge on KILLER side ${(bestKillEdgeRatio * 100).toFixed(0)}% — your kill (not a death).`,
        entries: [{ killerName: 'You', victimName: 'KillFeed', hasYellowEdge: false }],
        score,
      };
    }

    if (feedRows.length > 0) {
      return {
        state: 'low_confidence',
        confidence: Math.min(0.7, 0.35 + feedRows.length * 0.05),
        frameTimeMs: elapsed,
        detail: `📸 Snap: ${feedRows.length} kill-feed rows, no gold edge — not your death.`,
        entries: [{ killerName: 'KillFeed', victimName: 'Other', hasYellowEdge: false }],
        score,
      };
    }

    return {
      state: 'low_confidence',
      confidence: 0.05,
      frameTimeMs: elapsed,
      detail: `📸 Snap: no kill feed in top-right ${regionW}×${regionH}.`,
      score,
    };
  }

  /** Crop a region of the analyzed frame into a data URL (for OCR). */
  private _cropToDataUrl(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, scale = 3): string | null {
    if (w <= 0 || h <= 0) return null;
    const c = document.createElement('canvas');
    c.width = Math.max(2, Math.round(w * scale));
    c.height = Math.max(2, Math.round(h * scale));
    const cctx = c.getContext('2d');
    if (!cctx) return null;
    // Dark background so white game text contrasts well for OCR.
    cctx.fillStyle = '#000';
    cctx.fillRect(0, 0, c.width, c.height);
    cctx.imageSmoothingEnabled = true;
    cctx.drawImage(ctx.canvas, Math.round(x), Math.round(y), Math.round(w), Math.round(h), 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  }

  /** OCR a cropped nameplate region; returns null on failure/unavailability. */
  private async _recognizeNameplate(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ): Promise<{ text: string; confidence: number } | null> {
    const dataUrl = this._cropToDataUrl(ctx, x, y, w, h);
    if (!dataUrl) return null;
    try {
      const res = await window.electronAPI?.ocrRecognize?.(dataUrl);
      if (res?.success) {
        return { text: (res.text || '').trim(), confidence: res.confidence || 0 };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Detect the score from the top-center HUD display.
   * Valorant shows: [attack score] [mm:ss timer] [defense score] at center-top.
   * e.g. "3 - 5" means Attack 3, Defense 5.
   * Scans the center 40% × top 9% for bright white text, finds the colon separator,
   * then counts digit clusters on each side to estimate the score values.
   */
  private _detectScore(ctx: CanvasRenderingContext2D, imgW: number, imgH: number): string | undefined {
    const rx = Math.round(imgW * 0.28);
    const rw = Math.round(imgW * 0.44);
    const rh = Math.round(imgH * 0.09);
    if (rw < 10 || rh < 4) return undefined;

    const data = ctx.getImageData(rx, 0, rw, rh);
    const d = data.data;

    // Build column brightness profile: count bright (white-ish) pixels per column
    const cols = new Array(rw).fill(0);
    for (let x = 0; x < rw; x++) {
      let bright = 0;
      for (let y = 0; y < rh; y++) {
        const i = (y * rw + x) * 4;
        if (d[i] > 190 && d[i + 1] > 190 && d[i + 2] > 190) bright++;
      }
      cols[x] = bright;
    }

    const textThreshold = Math.max(1, rh * 0.25);

    // Find colon ':' — bright at ~1/3 and ~2/3 height, dark in middle
    let colonX = -1;
    for (let x = 3; x < rw - 3; x++) {
      if (cols[x] < textThreshold) continue;
      let top = 0, mid = 0, bot = 0;
      const h3 = Math.floor(rh / 3);
      for (let y = 0; y < h3; y++) { const i = (y * rw + x) * 4; if (d[i] > 190) top++; }
      for (let y = h3; y < 2 * h3; y++) { const i = (y * rw + x) * 4; if (d[i] > 190) mid++; }
      for (let y = 2 * h3; y < rh; y++) { const i = (y * rw + x) * 4; if (d[i] > 190) bot++; }
      if (top >= 1 && bot >= 1 && mid < Math.max(top, bot) * 0.6) {
        colonX = x;
        break;
      }
    }

    if (colonX < 0) return undefined;

    // Extract clusters (digit groups) left and right of colon
    const getClusters = (startX: number, endX: number): Array<{ start: number; end: number }> => {
      const result: Array<{ start: number; end: number }> = [];
      let inC = false;
      let s = 0;
      for (let x = startX; x < endX; x++) {
        if (cols[x] >= textThreshold) {
          if (!inC) { inC = true; s = x; }
        } else {
          if (inC) { if (x - s >= 2) result.push({ start: s, end: x }); inC = false; }
        }
      }
      if (inC && endX - s >= 2) result.push({ start: s, end: endX });
      return result;
    };

    const leftClusters = getClusters(0, colonX);
    const rightClusters = getClusters(colonX + 1, rw);

    // Format: [attack digits] [min tens] [min ones] [:] [sec tens] [sec ones] [defense digits]
    // Timer is always 2 digits each side, so score = left total - 2, right total - 2
    if (leftClusters.length < 2 && rightClusters.length < 2) return undefined;

    const attackClusterCount = Math.max(0, leftClusters.length - 2);
    const defenseClusterCount = Math.max(0, rightClusters.length - 2);

    // Rough estimate of each digit from cluster width
    const estimateDigit = (c: { start: number; end: number } | undefined): number => {
      if (!c) return 5;
      const w = c.end - c.start;
      // Width-based: '1' is narrow (~3px), '0'/'8' are wide (~7px+)
      if (w <= 3) return 1;
      if (w <= 5) return Math.round((w - 2) * 2); // 3→2, 4→4, 5→6
      return Math.min(9, Math.round((w - 3) * 1.5)); // 6→5, 7→6, 8→8
    };

    let attackScore = 0;
    if (attackClusterCount === 1) {
      const c = leftClusters[leftClusters.length - 3];
      attackScore = estimateDigit(c);
    } else if (attackClusterCount >= 2) {
      const tens = leftClusters[leftClusters.length - 4];
      const ones = leftClusters[leftClusters.length - 3];
      attackScore = estimateDigit(tens) * 10 + estimateDigit(ones);
    }

    let defenseScore = 0;
    if (defenseClusterCount === 1) {
      const c = rightClusters[2];
      defenseScore = estimateDigit(c);
    } else if (defenseClusterCount >= 2) {
      const tens = rightClusters[2];
      const ones = rightClusters[3];
      defenseScore = estimateDigit(tens) * 10 + estimateDigit(ones);
    }

    attackScore = Math.min(12, Math.max(0, attackScore));
    defenseScore = Math.min(12, Math.max(0, defenseScore));

    return `${attackScore} - ${defenseScore}`;
  }

  /** Debug: manually test a single snap capture */
  async testSnapOnce(): Promise<string> {
    const api = window.electronAPI;
    if (!api) return 'ERROR: no electronAPI at all (preload not loaded?)';
    if (typeof api.snapScreen !== 'function') return `ERROR: snapScreen is ${typeof api.snapScreen}, keys: ${Object.keys(api).join(', ')}`;
    try {
      const r = await api.snapScreen();
      return r.success ? `OK: ${r.bytes} bytes, ${r.width}x${r.height}` : `FAIL: ${r.error}`;
    } catch (err) {
      return `ERROR: ${err}`;
    }
  }

  /** Clear the snapshot buffer */
  clearSnapshots() {
    this._latestFrame = null;
    this._frameCount = 0;
    this._startTime = 0;
    this._captureStats = { captured: 0, dropped: 0 };
  }

  get isStableDeath(): boolean {
    return this._consecutiveDeaths >= 2 && (this._lastResult?.confidence ?? 0) >= 0.85;
  }

  get isStableSpectate(): boolean {
    return this._consecutiveSpectates >= 2;
  }

  get isPlayerKill(): boolean {
    return this._consecutiveKills >= 1 && this._state === 'my_kill';
  }

  get feedEntriesSeen() { return this._feedEntriesSeen; }

  get recommendation(): string {
    switch (this._state) {
      case 'idle':
        return 'Detector idle — watching top‑right for red/gold kill feed entries.';
      case 'scanning':
        return 'Scanning top‑right region for red (killer) / gold (victim) blocks…';
      case 'death_confirmed':
        if (this.isStableDeath) {
          return `✅ GREEN (victim) side has yellow edge across ${this._consecutiveDeaths} frames. You died. Opening overlay.`;
        }
        return '🟡 Yellow edge on victim (green) side — awaiting second frame…';
      case 'my_kill':
        return `🔴 Your name on RED (killer) side. You killed someone — no overlay needed.`;
      case 'spectate_rejected':
        if (this.isStableSpectate) {
          return '👁️ Spectate HUD detected. Yellow edge on victim side belongs to spectated player — suppressed.';
        }
        return '👁️ Spectate suspected — checking for observation bar…';
      case 'low_confidence':
        if (this._feedEntriesSeen > 0) {
          return '⚠️ Red/green kill entry found but no yellow edge — a teammate or enemy died.';
        }
        return '⚠️ No kill feed entries. Is the round active?';
      case 'error':
        return `❌ ${this._lastResult?.error || 'Detection error'}`;
    }
  }

  reset() {
    this.stopScanning();
    this._state = 'idle';
    this._lastResult = null;
    this._history = [];
    this._consecutiveDeaths = 0;
    this._consecutiveSpectates = 0;
    this._consecutiveKills = 0;
    this._feedEntriesSeen = 0;
  }
}

export const deathDetector = new DeathDetector();
