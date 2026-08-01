import { useState, useRef, useEffect } from "react";
import type { DetectionResult } from "../../death-detector";
import { settingsService } from "../../controller";

// ─── Demo Panel — runs the ONNX Siamese model on screen clips ────

interface FlawResult {
  flawType: string;
  flawName: string;
  confidence: number;
  severity: number;
}

const NUM_FRAMES = 8;
const FRAME_SIZE = 224;
const IMG_MEAN = [0.485, 0.456, 0.406];
const IMG_STD = [0.229, 0.224, 0.225];

/** Convert a data URL image to a normalized RGB Float32Array (224x224x3), ImageNet-normalized. */
function dataUrlToNormFrame(dataUrl: string): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = FRAME_SIZE;
      canvas.height = FRAME_SIZE;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, FRAME_SIZE, FRAME_SIZE);
      const data = ctx.getImageData(0, 0, FRAME_SIZE, FRAME_SIZE).data;
      const out = new Float32Array(FRAME_SIZE * FRAME_SIZE * 3);
      for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
        out[j] = (data[i] / 255 - IMG_MEAN[0]) / IMG_STD[0];
        out[j + 1] = (data[i + 1] / 255 - IMG_MEAN[1]) / IMG_STD[1];
        out[j + 2] = (data[i + 2] / 255 - IMG_MEAN[2]) / IMG_STD[2];
      }
      resolve(out);
    };
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = dataUrl;
  });
}

interface CaptureSource {
  screenIndex: number;
  source: "valorant" | "video" | "screen";
  sourceLabel: string;
  /** "window" = capture the game/video window directly; "screen" = whole display */
  mode: "window" | "screen";
  /** Which window predicate to use when mode === "window" */
  kind?: "valorant" | "video";
}

/**
 * Resolve which capture source to use. Prefers a live Valorant window;
 * falls back to a video viewer (demo playback), then screen 0.
 * Returns { screenIndex, source, sourceLabel, mode, kind }.
 */
async function resolveCaptureSource(): Promise<CaptureSource> {
  try {
    const det = await window.electronAPI?.detectScreens?.();
    if (det?.success) {
      if (det.valorantFound && det.valorantScreenIndex != null) {
        return { screenIndex: det.valorantScreenIndex, source: "valorant", sourceLabel: "Valorant", mode: "window", kind: "valorant" };
      }
      if (det.videoViewerFound && det.videoViewerScreenIndex != null) {
        return { screenIndex: det.videoViewerScreenIndex, source: "video", sourceLabel: "Video viewer", mode: "window", kind: "video" };
      }
    }
  } catch {}
  return { screenIndex: 0, source: "screen", sourceLabel: "Screen 1", mode: "screen" };
}

/** Higher-res capture for reliable kill-feed / yellow-edge detection. */
const CAPTURE_WIDTH = 960;
const CAPTURE_HEIGHT = 540;

/** Capture a single frame from the best available source (window or screen). */
async function captureFrame(src: Pick<CaptureSource, "mode" | "kind" | "screenIndex">): Promise<{ success: boolean; dataUrl?: string; error?: string }> {
  // Prefer capturing the game/video window directly so the kill-feed scan region
  // is the window's own top-right. Whole-screen capture breaks when the source is
  // a windowed video player — the feed isn't in the screen's top-right corner.
  if (src.mode === "window" && window.electronAPI?.snapWindow) {
    try {
      const res = await window.electronAPI.snapWindow(src.kind, { width: CAPTURE_WIDTH, height: CAPTURE_HEIGHT });
      if (res?.success && res.dataUrl) return { success: true, dataUrl: res.dataUrl };
    } catch {}
    // fall through to whole-screen capture below
  }
  if (!window.electronAPI?.snapScreen) return { success: false, error: "No capture API" };
  const res = await window.electronAPI.snapScreen(src.screenIndex, { width: CAPTURE_WIDTH, height: CAPTURE_HEIGHT });
  if (res?.success && res.dataUrl) return { success: true, dataUrl: res.dataUrl };
  return { success: false, error: res?.error || "Capture failed" };
}

/** Capture N frames from the resolved source at ~50ms intervals. */
async function captureClip(src: CaptureSource, n = NUM_FRAMES): Promise<Float32Array[]> {
  const frames: Float32Array[] = [];
  for (let i = 0; i < n; i++) {
    const res = await captureFrame(src);
    if (!res.success || !res.dataUrl) {
      if (frames.length === 0) throw new Error(res.error || "Capture failed");
      break; // use what we have
    }
    frames.push(await dataUrlToNormFrame(res.dataUrl));
    if (i < n - 1) await new Promise((r) => setTimeout(r, 50));
  }
  if (frames.length < 3) throw new Error("Not enough frames captured");
  return frames;
}

function StatusChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-[4px] px-[6px] py-[2px] rounded-full text-[9px]"
      style={{
        background: ok ? "rgba(127,217,98,0.1)" : "rgba(255,255,255,0.04)",
        color: ok ? "#7fd962" : "#8e8e93",
        border: `1px solid ${ok ? "rgba(127,217,98,0.3)" : "rgba(255,255,255,0.08)"}`,
        fontFamily: "Geist Mono, monospace",
      }}
    >
      {ok ? "●" : "○"} {label}
    </span>
  );
}

export default function DemoPanel({ deathDetector }: { deathDetector: any }) {
  const [modelStatus, setModelStatus] = useState<"unloaded" | "loading" | "loaded" | "error">("unloaded");
  const [flawTypes, setFlawTypes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [referenceReady, setReferenceReady] = useState(false);
  const [result, setResult] = useState<FlawResult | null>(null);
  const [message, setMessage] = useState("");
  const [captureSource, setCaptureSource] = useState(""); // "Valorant" | "Video viewer" | "Screen N"
  const [watching, setWatching] = useState(false); // actively watching a round
  const [framesWatched, setFramesWatched] = useState(0);
  const refFrames = useRef<number[][] | null>(null);
  const watchTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchFrames = useRef<Float32Array[]>([]); // rolling buffer of the last NUM_FRAMES frames
  const watchSource = useRef<CaptureSource>({ screenIndex: 0, source: "screen", sourceLabel: "Screen 1", mode: "screen" });
  const watchBusy = useRef(false);
  const watchStartedAt = useRef(0);
  // Armed only after the kill feed has cleared (no death edge). Prevents a
  // lingering yellow-edge entry from a previous death/test from triggering
  // immediately when a new watch starts. A force-arm fallback guarantees we
  // never stay disarmed forever even if the feed never fully clears.
  const watchArmed = useRef(false);
  const [watchDiag, setWatchDiag] = useState(""); // live detector detail while watching
  const [playerName, setPlayerNameState] = useState(() => (settingsService.get("playerName") as string) || "");

  // Clean up the round watcher on unmount
  useEffect(() => () => stopWatching(), []);

  // Keep the detector's OCR player name in sync with settings
  useEffect(() => {
    deathDetector.setPlayerName((settingsService.get("playerName") as string) || "");
  }, [deathDetector]);

  function stopWatching() {
    if (watchTimer.current) {
      clearInterval(watchTimer.current);
      watchTimer.current = null;
    }
    watchBusy.current = false;
    setWatching(false);
    setFramesWatched(0);
    setWatchDiag("");
  }

  async function handleLoadModel() {
    setModelStatus("loading");
    setMessage("");
    try {
      const res = await window.electronAPI?.loadModel?.();
      if (res?.success) {
        setModelStatus("loaded");
        setFlawTypes(res.flawTypes || []);
        setMessage(`Model ready — ${res.flawTypes?.length || 0} flaw types`);
      } else {
        setModelStatus("error");
        setMessage(res?.error || "Failed to load model");
      }
    } catch (e: any) {
      setModelStatus("error");
      setMessage(String(e?.message || e));
    }
  }

  async function handleCaptureReference() {
    setBusy(true);
    setMessage("Capturing reference clip…");
    try {
      const src = await resolveCaptureSource();
      setCaptureSource(src.sourceLabel);
      const frames = await captureClip(src);
      refFrames.current = frames.map((f) => Array.from(f));
      setReferenceReady(true);
      setResult(null);
      setMessage(`Reference captured — ${frames.length} frames (${src.sourceLabel})`);
    } catch (e: any) {
      setMessage(String(e?.message || e));
    }
    setBusy(false);
  }

  /** Run the model on the frames buffered right before the death. */
  async function runDeathAnalysis() {
    const frames = watchFrames.current;
    const src = watchSource.current;
    if (!refFrames.current || frames.length < 3) {
      setMessage(frames.length < 3 ? "Not enough frames captured before death" : "Capture a reference clip first");
      return;
    }
    setBusy(true);
    setMessage("Death detected — analyzing clip…");
    try {
      const res = await window.electronAPI?.detectFlaw?.({
        flawedFrames: frames.map((f) => Array.from(f)),
        flawlessFrames: refFrames.current,
      });
      if (res?.success) {
        setResult({
          flawType: res.flawType || "UNKNOWN",
          flawName: res.flawName || res.flawType || "UNKNOWN",
          confidence: res.confidence ?? 0,
          severity: res.severity ?? 0,
        });
        setMessage(`Detected ${res.flawName || res.flawType} (${(res.confidence! * 100).toFixed(1)}%) · ${src.sourceLabel}`);
      } else {
        setMessage(res?.error || "Analysis failed");
      }
    } catch (e: any) {
      setMessage(String(e?.message || e));
    }
    setBusy(false);
  }

  /**
   * Watch the whole round: continuously capture frames into a rolling buffer,
   * detect the player's death from the kill feed, and only then run the model
   * on the clip that led up to the death.
   */
  async function handleWatchRound() {
    if (watching) {
      stopWatching();
      setMessage("Round watch stopped");
      return;
    }
    if (!refFrames.current) {
      setMessage("Capture a reference clip first");
      return;
    }

    const src = await resolveCaptureSource();
    watchSource.current = src;
    watchFrames.current = [];
    watchBusy.current = false;
    watchArmed.current = false; // wait for the kill feed to clear before arming
    watchStartedAt.current = Date.now();
    setCaptureSource(src.sourceLabel);
    setResult(null);
    setFramesWatched(0);
    setWatchDiag("");
    setWatching(true);
    setMessage(`Watching round… waiting for feed to clear (${src.sourceLabel})`);

    const WATCH_INTERVAL = 100; // ms — ~10 fps rolling buffer
    const WARMUP_MS = 800;      // ignore detections for the first 0.8s
    const FORCE_ARM_MS = 5000;  // if the feed never fully clears, arm anyway

    watchTimer.current = setInterval(async () => {
      if (watchBusy.current) return;
      watchBusy.current = true;
      try {
        const res = await captureFrame(watchSource.current);
        if (!res.success || !res.dataUrl) {
          watchBusy.current = false;
          return;
        }

        // 1) Buffer the normalized frame (keep the last NUM_FRAMES)
        const norm = await dataUrlToNormFrame(res.dataUrl);
        watchFrames.current.push(norm);
        if (watchFrames.current.length > NUM_FRAMES) watchFrames.current.shift();
        setFramesWatched((n) => n + 1);

        // 2) Check this frame for a death (kill-feed yellow edge)
        const det: DetectionResult = await deathDetector.analyzeFrame(res.dataUrl);
        const elapsed = Date.now() - watchStartedAt.current;

        // 3) Arming: once the feed is clear (no death edge), arm the detector.
        //    Force-arm after FORCE_ARM_MS so a busy feed never blocks detection.
        if (elapsed < WARMUP_MS) {
          // still warming up — don't arm or fire yet
        } else if (det.state === 'death_confirmed' && det.confidence >= 0.6) {
          if (watchArmed.current) {
            // Fresh death after the feed had cleared → stop & analyze immediately
            stopWatching();
            await runDeathAnalysis();
            watchBusy.current = false;
            return;
          }
          // Not armed yet — likely a lingering yellow edge from a previous
          // death/test. Keep watching until the feed clears (or force-arm).
        } else {
          if (!watchArmed.current) {
            watchArmed.current = true;
            setMessage(`Watching round… armed, waiting for your death (${watchSource.current.sourceLabel})`);
          }
        }
        if (!watchArmed.current && elapsed >= FORCE_ARM_MS) {
          watchArmed.current = true;
          setMessage(`Watching round… armed (forced), waiting for your death (${watchSource.current.sourceLabel})`);
        }

        // Live diagnostics so the demo shows what the detector sees
        if (watchArmed.current) setWatchDiag(det.detail || "");
      } catch {
        // ignore transient capture errors and keep watching
      }
      watchBusy.current = false;
    }, WATCH_INTERVAL);
  }

  return (
    <div
      className="relative rounded-[16px] w-full shrink-0"
      style={{
        background: "#16161a",
        border: "1px solid rgba(255,255,255,0.05)",
        boxShadow: "4px 4px 8px rgba(0,0,0,0.31), -4px -4px 8px rgba(255,255,255,0.03)",
      }}
    >
      <div className="flex flex-col gap-[10px] items-start p-[16px]">
        <div className="flex items-center justify-between w-full">
          <p className="text-[11px] text-[#8e8e93]" style={{ fontFamily: "Geist Mono, monospace", fontWeight: 700 }}>
            FLAW MODEL DEMO
          </p>
          <div className="flex gap-[6px] items-center">
            <StatusChip ok={modelStatus === "loaded"} label={modelStatus === "loaded" ? `Model (${flawTypes.length} classes)` : "Model off"} />
            <StatusChip ok={referenceReady} label={referenceReady ? "Ref ready" : "No ref"} />
            {captureSource && <StatusChip ok label={captureSource} />}
            {watching && <StatusChip ok label={`Watching · ${framesWatched}f`} />}
          </div>
        </div>

        <div className="flex flex-wrap gap-[8px] items-center w-full">
          <button
            onClick={handleLoadModel}
            disabled={busy || modelStatus === "loading"}
            className="text-[11px] px-[10px] py-[5px] rounded-[8px] transition-all duration-150 focus:outline-none"
            style={{
              background: modelStatus === "loaded" ? "rgba(157,78,221,0.12)" : "#240046",
              border: `1px solid ${modelStatus === "loaded" ? "rgba(157,78,221,0.35)" : "#9d4edd"}`,
              color: "white",
              fontFamily: "Geist, sans-serif",
              fontWeight: 600,
              opacity: busy ? 0.5 : 1,
            }}
          >
            {modelStatus === "loading" ? "Loading…" : modelStatus === "loaded" ? "Model loaded" : "Load model"}
          </button>
          <button
            onClick={handleCaptureReference}
            disabled={busy || modelStatus !== "loaded"}
            className="text-[11px] px-[10px] py-[5px] rounded-[8px] transition-all duration-150 focus:outline-none"
            style={{
              background: referenceReady ? "rgba(157,78,221,0.12)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${referenceReady ? "rgba(157,78,221,0.35)" : "rgba(255,255,255,0.07)"}`,
              color: referenceReady ? "#9d4edd" : "#8e8e93",
              fontFamily: "Geist, sans-serif",
              fontWeight: 600,
              opacity: busy || modelStatus !== "loaded" ? 0.5 : 1,
            }}
          >
            {referenceReady ? "Re-capture reference" : "Capture reference"}
          </button>
          <button
            onClick={handleWatchRound}
            disabled={busy || !referenceReady}
            className="text-[11px] px-[10px] py-[5px] rounded-[8px] transition-all duration-150 focus:outline-none"
            style={{
              background: watching ? "rgba(255,77,109,0.12)" : "#240046",
              border: `1px solid ${watching ? "#ff4d6d" : "#9d4edd"}`,
              color: watching ? "#ff4d6d" : "white",
              fontFamily: "Geist, sans-serif",
              fontWeight: 600,
              opacity: busy || !referenceReady ? 0.5 : 1,
            }}
          >
            {watching ? "Stop watch" : busy ? "Working…" : "Watch round"}
          </button>
        </div>

        <div className="flex items-center gap-[8px] w-full">
          <span className="text-[10px] shrink-0 text-[#8e8e93]" style={{ fontFamily: "Geist Mono, monospace" }}>
            Your name (OCR confirm)
          </span>
          <input
            value={playerName}
            onChange={(e) => {
              const v = e.target.value;
              setPlayerNameState(v);
              settingsService.set("playerName", v);
              deathDetector.setPlayerName(v);
            }}
            placeholder="e.g. MyRiotTag"
            spellCheck={false}
            autoComplete="off"
            className="flex-1 min-w-0 text-[11px] px-[8px] py-[4px] rounded-[8px] focus:outline-none"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "white",
              fontFamily: "Geist Mono, monospace",
            }}
          />
        </div>

        {result && (
          <div
            className="w-full rounded-[10px] p-[10px] flex items-center justify-between"
            style={{
              background: "rgba(157,78,221,0.08)",
              border: "1px solid rgba(157,78,221,0.25)",
            }}
          >
            <div className="flex flex-col gap-[2px]">
              <span className="text-[16px] text-white" style={{ fontFamily: "Geist, sans-serif", fontWeight: 700 }}>
                {result.flawName}
              </span>
              <span className="text-[10px] text-[#8e8e93]" style={{ fontFamily: "Geist Mono, monospace" }}>
                {result.flawType} · confidence {(result.confidence * 100).toFixed(1)}% · severity {result.severity.toFixed(2)}
              </span>
            </div>
            <div className="flex-1 h-[4px] rounded-full mx-[12px]" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.round(result.confidence * 100)}%`,
                  background: "linear-gradient(90deg, #7b2cbf, #9d4edd)",
                }}
              />
            </div>
            <span className="text-[20px]">{result.severity > 0.6 ? "🔴" : result.severity > 0.3 ? "🟡" : "🟢"}</span>
          </div>
        )}

        {message && (
          <p className="text-[11px] w-full" style={{ fontFamily: "Geist Mono, monospace", color: "#c4c4c6" }}>
            {message}
          </p>
        )}

        {watching && watchDiag && (
          <p className="text-[10px] w-full truncate" style={{ fontFamily: "Geist Mono, monospace", color: "#6e6e73" }}>
            {watchDiag}
          </p>
        )}
      </div>
    </div>
  );
}
