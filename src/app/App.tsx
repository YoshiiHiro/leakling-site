import { useState, useRef, useEffect } from "react";
import { Monitor, FlaskConical, Settings } from "lucide-react";
import svgPaths from "../imports/LeaklingNeumorphism/svg-928pdd1may";
import appIcon from "../../gAsset 3.png";
import {
  eventBus,
  settingsService,
  simulateDeath,
  simulateTag,
  endMockMatch,
  clearAllData,
  getCauseCounts,
  getTopCauses,
  getAllEntries,
  deathDetector,
  LABELS,
} from "../controller";
import { MOCK_MODE } from "../../scripts/constants.js";
import type { DetectionResult } from "../death-detector";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "overlay" | "mock" | "recent-matches" | "settings";
type StatusEntry = { icon: "skull" | "tag" | "stop"; message: string; highlight: string; suffix: string };
type TagEntry = { label: string; meta: string };
type MatchEntry = { id: number; type: "mock" | "real"; result?: "win" | "loss"; timestamp: string; tags: TagEntry[]; map: string };

const VALORANT_MAPS = ["Ascent", "Bind", "Haven", "Split", "Icebox", "Breeze", "Fracture", "Pearl", "Lotus", "Sunset", "Abyss"];

const FOCUS_OPTIONS = [
  "— clear —",
  "Peeking angles",
  "Utility usage",
  "Economy decisions",
  "Map awareness",
  "Crosshair placement",
  "Communication",
  "Timing mistakes",
];

// ─── Screen capture + model helpers ───────────────────────────────────────────

const NUM_FRAMES = 8;
const FRAME_SIZE = 224;
const IMG_MEAN = [0.485, 0.456, 0.406];
const IMG_STD = [0.229, 0.224, 0.225];

/** Convert a data URL image to a normalized RGB Float32Array (224x224x3). */
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
  mode: "window" | "screen";
  kind?: "valorant" | "video";
}

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

const CAPTURE_WIDTH = 960;
const CAPTURE_HEIGHT = 540;

async function captureFrame(src: Pick<CaptureSource, "mode" | "kind" | "screenIndex">): Promise<{ success: boolean; dataUrl?: string; error?: string }> {
  if (src.mode === "window" && window.electronAPI?.snapWindow) {
    try {
      const res = await window.electronAPI.snapWindow(src.kind, { width: CAPTURE_WIDTH, height: CAPTURE_HEIGHT });
      if (res?.success && res.dataUrl) return { success: true, dataUrl: res.dataUrl };
    } catch {}
  }
  if (!window.electronAPI?.snapScreen) return { success: false, error: "No capture API" };
  const res = await window.electronAPI.snapScreen(src.screenIndex, { width: CAPTURE_WIDTH, height: CAPTURE_HEIGHT });
  if (res?.success && res.dataUrl) return { success: true, dataUrl: res.dataUrl };
  return { success: false, error: res?.error || "Capture failed" };
}

async function captureClip(src: CaptureSource, n = NUM_FRAMES): Promise<Float32Array[]> {
  const frames: Float32Array[] = [];
  for (let i = 0; i < n; i++) {
    const res = await captureFrame(src);
    if (!res.success || !res.dataUrl) {
      if (frames.length === 0) throw new Error(res.error || "Capture failed");
      break;
    }
    frames.push(await dataUrlToNormFrame(res.dataUrl));
    if (i < n - 1) await new Promise((r) => setTimeout(r, 50));
  }
  if (frames.length < 3) throw new Error("Not enough frames captured");
  return frames;
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function SkullIcon({ color = "white" }: { color?: string }) {
  return (
    <svg className="block size-full" fill="none" height="14" viewBox="0 0 14 14" width="14">
      <path d={svgPaths.p2869a500} stroke={color} strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function MockSkullIcon({ color = "white" }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      {/* skull dome + jaw */}
      <path
        d="M3 6.5C3 3.96 4.79 2 7 2C9.21 2 11 3.96 11 6.5C11 7.9 10.38 9.14 9.4 9.96L9.4 11.5C9.4 11.78 9.18 12 8.9 12H5.1C4.82 12 4.6 11.78 4.6 11.5L4.6 9.96C3.62 9.14 3 7.9 3 6.5Z"
        stroke={color} strokeWidth="1.6" strokeLinejoin="round"
      />
      {/* eye sockets */}
      <circle cx="5.3" cy="6.2" r="1" stroke={color} strokeWidth="1.4" />
      <circle cx="8.7" cy="6.2" r="1" stroke={color} strokeWidth="1.4" />
    </svg>
  );
}

function TagIcon({ color = "#8E8E93" }: { color?: string }) {
  return (
    <svg className="block size-full" fill="none" height="14" viewBox="0 0 14 14" width="14">
      <clipPath id="clip-tag"><rect fill="white" height="14" width="14" /></clipPath>
      <g clipPath="url(#clip-tag)">
        <path d={svgPaths.p3b8ef970} stroke={color} strokeLinecap="round" strokeWidth="2" />
      </g>
    </svg>
  );
}

function StopIcon({ color = "#8E8E93" }: { color?: string }) {
  return (
    <svg className="block size-full" fill="none" height="14" viewBox="0 0 14 14" width="14">
      <clipPath id="clip-stop"><rect fill="white" height="14" width="14" /></clipPath>
      <g clipPath="url(#clip-stop)">
        <path d={svgPaths.p33911600} stroke={color} strokeLinecap="round" strokeWidth="2" />
      </g>
    </svg>
  );
}

function TrashIcon({ color = "#FF4D6D" }: { color?: string }) {
  return (
    <svg className="block size-full" fill="none" height="14" viewBox="0 0 14 14" width="14">
      <clipPath id="clip-trash"><rect fill="white" height="14" width="14" /></clipPath>
      <g clipPath="url(#clip-trash)">
        <path d={svgPaths.p234d2680} stroke={color} strokeLinecap="round" strokeWidth="2" />
      </g>
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className="block size-full transition-transform duration-200"
      style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
      fill="none" height="12" viewBox="0 0 12 12" width="12"
    >
      <path d="M3 4.5L6 7.5L9 4.5" stroke="#8E8E93" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

// ─── Switch ───────────────────────────────────────────────────────────────────

function Switch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="relative h-[22px] w-[42px] rounded-full transition-all duration-300 cursor-pointer focus:outline-none"
      style={{
        background: on ? "#9D4EDD" : "#3a3a40",
        boxShadow: on
          ? "0 0 2px #9d4edd, 3px 3px 12px rgba(123,44,191,0.3), -3px -3px 6px rgba(255,255,255,0.05)"
          : "inset 2px 2px 4px rgba(0,0,0,0.4), inset -2px -2px 4px rgba(255,255,255,0.03)",
      }}
      aria-pressed={on}
    >
      <span
        className="absolute top-[3px] h-[16px] w-[16px] rounded-full bg-white transition-all duration-300"
        style={{
          left: on ? "calc(100% - 19px)" : "3px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
        }}
      />
    </button>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function Tab({ label, sub, active, onClick }: { label: string; sub: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="relative flex gap-[8px] items-center px-[16px] py-[8px] rounded-full cursor-pointer transition-all duration-200 focus:outline-none"
      style={{
        background: active ? "#16161a" : "rgba(0,0,0,0)",
        boxShadow: active
          ? "0 0 2px #9d4edd, 3px 3px 12px rgba(123,44,191,0.3), -3px -3px 6px rgba(255,255,255,0.05)"
          : undefined,
      }}
    >
      <div
        className="absolute inset-0 rounded-full border border-solid pointer-events-none"
        style={{ borderColor: active ? "#9d4edd" : "rgba(255,255,255,0.05)" }}
      />
      <span
        className="text-[13px] text-white whitespace-nowrap"
        style={{ fontFamily: "Geist, sans-serif", fontWeight: active ? 600 : 500 }}
      >
        {label}
      </span>
      {sub && (
        <span
          className="text-[11px] whitespace-nowrap"
          style={{
            fontFamily: "Geist Mono, monospace",
            fontWeight: 400,
            color: active ? "#9d4edd" : "#545458",
          }}
        >
          {sub}
        </span>
      )}
    </button>
  );
}

// ─── Action Buttons ───────────────────────────────────────────────────────────

function ActionBtn({
  icon, label, variant, onClick, disabled,
}: {
  icon?: React.ReactNode;
  label: string;
  variant: "purple" | "neutral" | "danger";
  onClick: () => void;
  disabled?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const base =
    variant === "purple"
      ? { bg: "#240046", border: "#9d4edd", text: "white", shadow: "0px 0px 2px #9d4edd, 3px 3px 12px rgba(123,44,191,0.3), -3px -3px 6px rgba(255,255,255,0.05)" }
      : variant === "danger"
      ? { bg: "#16161a", border: "rgba(230,57,70,0.3)", text: "#ff4d6d", shadow: "4px 4px 8px rgba(0,0,0,0.31), -4px -4px 8px rgba(255,255,255,0.03)" }
      : { bg: "#16161a", border: "rgba(255,255,255,0.05)", text: "white", shadow: "4px 4px 8px rgba(0,0,0,0.31), -4px -4px 8px rgba(255,255,255,0.03)" };

  const hoverBg =
    variant === "purple" ? "#3b006e"
    : variant === "danger" ? "#1f1014"
    : "#1e1e23";

  const activeBg =
    variant === "purple" ? "#16003a"
    : variant === "danger" ? "#160810"
    : "#121216";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      className="relative flex gap-[8px] items-center px-[14px] py-[8px] rounded-[10px] cursor-pointer transition-all duration-150 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        background: pressed ? activeBg : hovered ? hoverBg : base.bg,
        transform: pressed ? "scale(0.97)" : "scale(1)",
      }}
    >
      <div
        className="absolute inset-0 rounded-[10px] border border-solid pointer-events-none"
        style={{ borderColor: base.border, boxShadow: base.shadow }}
      />
      {icon && <span className="relative shrink-0 size-[14px]">{icon}</span>}
      <span
        className="relative text-[13px] whitespace-nowrap"
        style={{ fontFamily: "Geist, sans-serif", fontWeight: 600, color: base.text }}
      >
        {label}
      </span>
    </button>
  );
}

// ─── Dropdown ─────────────────────────────────────────────────────────────────

function FocusDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex gap-[20px] items-center px-[16px] py-[10px] rounded-[10px] cursor-pointer transition-all duration-150 focus:outline-none"
        style={{ background: "#0b0b0d" }}
      >
        <div className="absolute inset-0 rounded-[10px] border border-solid border-[rgba(255,255,255,0.05)] pointer-events-none" />
        <span
          className="text-[13px] text-white whitespace-nowrap"
          style={{ fontFamily: "Geist Mono, monospace", fontWeight: 500 }}
        >
          {value}
        </span>
        <span className="shrink-0 size-[12px]">
          <ChevronIcon open={open} />
        </span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[200px] rounded-[12px] overflow-hidden py-[6px]"
          style={{
            background: "#0b0b0d",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(157,78,221,0.1)",
          }}
        >
          {FOCUS_OPTIONS.map((opt) => (
            <button
              key={opt}
              onClick={() => { onChange(opt); setOpen(false); }}
              className="w-full text-left px-[14px] py-[8px] text-[13px] transition-colors duration-100 focus:outline-none"
              style={{
                fontFamily: "Geist Mono, monospace",
                fontWeight: 500,
                color: opt === value ? "#9d4edd" : opt === "— clear —" ? "#545458" : "white",
                background: opt === value ? "rgba(157,78,221,0.08)" : "transparent",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)"; }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  opt === value ? "rgba(157,78,221,0.08)" : "transparent";
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Arrow Scroll Button ──────────────────────────────────────────────────────

function ArrowScrollBtn({ direction, onClick }: { direction: "up" | "down"; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      className="shrink-0 w-full flex items-center justify-center py-[4px] rounded-[6px] transition-all duration-100 focus:outline-none"
      style={{
        background: pressed
          ? "rgba(157,78,221,0.25)"
          : hovered
          ? "rgba(157,78,221,0.12)"
          : "rgba(255,255,255,0.03)",
        border: `1px solid ${pressed ? "rgba(157,78,221,0.5)" : hovered ? "rgba(157,78,221,0.25)" : "rgba(255,255,255,0.05)"}`,
        transform: pressed ? "scale(0.95)" : "scale(1)",
      }}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path
          d={direction === "up" ? "M3 7.5L6 4.5L9 7.5" : "M3 4.5L6 7.5L9 4.5"}
          stroke={hovered || pressed ? "#9d4edd" : "#545458"}
          strokeLinecap="round"
          strokeWidth="2"
        />
      </svg>
    </button>
  );
}

// ─── Status Box ───────────────────────────────────────────────────────────────

function StatusBox({ entry }: { entry: StatusEntry | null }) {
  if (!entry) return null;
  return (
    <div
      className="relative rounded-[12px] w-full"
      style={{
        background: "#0b0b0d",
        border: "1px solid rgba(0,0,0,0.5)",
        boxShadow: "inset 2px 2px 4px rgba(0,0,0,0.5)",
      }}
    >
      <div className="flex gap-[10px] items-start p-[12px]">
        <span className="shrink-0 size-[14px] mt-[1px]">
          {entry.icon === "skull" && <SkullIcon color="#9D4EDD" />}
          {entry.icon === "tag" && <TagIcon color="#9D4EDD" />}
          {entry.icon === "stop" && <StopIcon color="#9D4EDD" />}
        </span>
        <p
          className="text-[12px] text-white whitespace-nowrap"
          style={{ fontFamily: "Geist Mono, monospace", fontWeight: 400 }}
        >
          {entry.message}
          {entry.highlight && <span style={{ color: "#9d4edd" }}> {entry.highlight}</span>}
          {entry.suffix && <span>{entry.suffix}</span>}
        </p>
      </div>
    </div>
  );
}

// ─── Cause Breakdown ──────────────────────────────────────────────────────────

function CauseBreakdown({ tags, accentColor = "#9d4edd" }: { tags: TagEntry[]; accentColor?: string }) {
  if (tags.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 w-full">
        <p className="text-[14px] text-center text-[#545458]" style={{ fontFamily: "Geist, sans-serif", fontWeight: 400 }}>
          Die, review, find your leak
        </p>
      </div>
    );
  }

  const counts: Record<string, number> = {};
  tags.forEach((t) => { counts[t.label] = (counts[t.label] || 0) + 1; });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = sorted[0]?.[1] || 1;

  return (
    <div className="flex flex-col gap-[8px] w-full mt-[4px]">
      {sorted.map(([label, count]) => (
        <div key={label} className="flex items-center gap-[10px]">
          <span
            className="text-[11px] text-[#8e8e93] w-[110px] shrink-0 truncate"
            style={{ fontFamily: "Geist, sans-serif", fontWeight: 500 }}
          >
            {label}
          </span>
          <div className="flex-1 h-[6px] rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(count / max) * 100}%`,
                background: accentColor,
                boxShadow: `0 0 6px ${accentColor}66`,
              }}
            />
          </div>
          <span
            className="text-[11px] text-[#545458] w-[16px] text-right shrink-0"
            style={{ fontFamily: "Geist Mono, monospace", fontWeight: 400 }}
          >
            {count}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Recent Tags ──────────────────────────────────────────────────────────────

function RecentTags({ tags }: { tags: TagEntry[] }) {
  if (tags.length === 0) {
    return (
      <p className="text-[13px] text-[#545458]" style={{ fontFamily: "Geist, sans-serif" }}>
        No tags yet
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-[6px] w-full">
      {[...tags].reverse().map((t, i) => (
        <div
          key={i}
          className="relative rounded-[10px] w-full"
          style={{ background: "#0b0b0d" }}
        >
          <div className="flex items-center justify-between px-[12px] py-[10px]">
            <span
              className="text-[13px] text-[#8e8e93]"
              style={{ fontFamily: "Geist, sans-serif", fontWeight: 600 }}
            >
              {t.label}
            </span>
            <span
              className="text-[12px] text-[#545458]"
              style={{ fontFamily: "Geist Mono, monospace", fontWeight: 400 }}
            >
              {t.meta}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Death Cause Popup ────────────────────────────────────────────────────────

/** Full flaw taxonomy used by the detection AI (31 subtypes from flaw_types.json idx_to_name). */
const DEATH_CAUSES = [
  "Floor-aiming",
  "Bad pre-aim",
  "No pre-fire",
  "Target lock delay",
  "Over-flicking",
  "Body-level spray at range",
  "Standing in the open",
  "Wide-peeking with OP",
  "Exposed flank",
  "Crouch-spray habit",
  "Bad off-angle",
  "Over-rotating",
  "Wrong rotation",
  "Peeking with disadvantage",
  "Not trading",
  "Bad economy buy",
  "No spike plant",
  "Over-healing",
  "Spray too long",
  "No burst at range",
  "Slow weapon swap",
  "No info check",
  "Not using audio",
  "Tunnel vision",
  "Map blindness",
  "Lurking too long",
  "Ability withholding",
  "Wasted utility",
  "Self-blind",
  "Late utility",
  "Missing easy utility kill",
];

function DeathCausePopup({ onTag }: { onTag: (cause: string) => void }) {
  const [selected, setSelected] = useState<string>(DEATH_CAUSES[0]);
  const [dismissed, setDismissed] = useState(false);
  const [tagged, setTagged] = useState(false);
  const [countdown, setCountdown] = useState(6);

  useEffect(() => {
    if (dismissed) return;
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(t); setDismissed(true); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [dismissed]);

  function handleTag() {
    onTag(selected);
    setTagged(true);
    setTimeout(() => setDismissed(true), 900);
  }

  function handleReset() {
    setSelected(DEATH_CAUSES[0]);
    setTagged(false);
    setDismissed(false);
    setCountdown(6);
  }

  return (
    <div className="flex flex-col gap-[10px] items-start w-full">
      <div className="flex items-center justify-between w-full">
        <p className="text-[11px] text-[#8e8e93]" style={{ fontFamily: "Geist Mono, monospace", fontWeight: 700 }}>
          DEATH OVERLAY POPUP
        </p>
        <button
          onClick={handleReset}
          className="text-[10px] text-[#545458] hover:text-[#8e8e93] transition-colors duration-150 focus:outline-none"
          style={{ fontFamily: "Geist Mono, monospace", fontWeight: 500 }}
        >
          reset preview
        </button>
      </div>

      {/* The popup itself */}
      <div className="relative" style={{ width: 316 }}>
        {/* Dismissed state */}
        {dismissed && !tagged && (
          <div
            className="flex items-center justify-center rounded-[14px] px-[20px] py-[14px]"
            style={{
              background: "rgba(11,11,13,0.6)",
              border: "1px solid rgba(255,255,255,0.05)",
              backdropFilter: "blur(12px)",
              width: 316,
            }}
          >
            <p className="text-[12px] text-[#545458]" style={{ fontFamily: "Geist Mono, monospace" }}>
              overlay auto-dismissed
            </p>
          </div>
        )}

        {/* Tagged state */}
        {tagged && (
          <div
            className="flex items-center gap-[10px] rounded-[14px] px-[16px] py-[14px]"
            style={{
              background: "rgba(11,11,13,0.85)",
              border: "1px solid rgba(157,78,221,0.3)",
              boxShadow: "0 0 20px rgba(157,78,221,0.12)",
              backdropFilter: "blur(12px)",
              width: 316,
            }}
          >
            <span className="shrink-0 size-[14px]"><TagIcon color="#9d4edd" /></span>
            <p className="text-[12px] text-white" style={{ fontFamily: "Geist Mono, monospace", fontWeight: 500 }}>
              Tagged: <span style={{ color: "#9d4edd" }}>{selected}</span>
            </p>
          </div>
        )}

        {/* Active popup */}
        {!dismissed && !tagged && (
          <div
            className="flex flex-col rounded-[14px] overflow-hidden"
            style={{
              background: "rgba(11,11,13,0.92)",
              border: "1px solid rgba(255,255,255,0.07)",
              boxShadow: "0 0 0 1px rgba(157,78,221,0.12), 0 8px 32px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)",
              backdropFilter: "blur(16px)",
              width: 316,
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-[14px] py-[10px]"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
            >
              <div className="flex items-center gap-[8px]">
                <span className="shrink-0 size-[14px]"><SkullIcon color="#9d4edd" /></span>
                <p className="text-[12px] text-white" style={{ fontFamily: "Geist, sans-serif", fontWeight: 700, letterSpacing: "-0.01em" }}>
                  Cause of death?
                </p>
              </div>
              <div className="flex items-center gap-[6px]">
                <div
                  className="w-[28px] h-[3px] rounded-full overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(countdown / 6) * 100}%`,
                      background: countdown <= 3 ? "#ff4d6d" : "#9d4edd",
                      transition: "width 1s linear, background 0.3s",
                    }}
                  />
                </div>
                <p
                  className="text-[10px] tabular-nums"
                  style={{
                    fontFamily: "Geist Mono, monospace",
                    fontWeight: 500,
                    color: countdown <= 3 ? "#ff4d6d" : "#545458",
                    minWidth: 12,
                  }}
                >
                  {countdown}s
                </p>
              </div>
            </div>

            {/* Single cause selector */}
            <div className="px-[10px] pt-[4px] pb-[2px]">
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="w-full px-[12px] py-[8px] rounded-[8px] text-[12px] text-white focus:outline-none appearance-none cursor-pointer transition-colors duration-150"
                style={{
                  fontFamily: "Geist, sans-serif",
                  fontWeight: 600,
                  background: "rgba(157,78,221,0.18)",
                  border: "1px solid rgba(157,78,221,0.45)",
                  boxShadow: "0 0 8px rgba(157,78,221,0.15)",
                }}
              >
                {DEATH_CAUSES.map((c) => (
                  <option key={c} value={c} style={{ background: "#16161a", color: "white" }}>{c}</option>
                ))}
              </select>
            </div>

            {/* Footer */}
            <div
              className="flex items-center gap-[8px] px-[10px] pb-[10px]"
            >
              <button
                onClick={handleTag}
                className="flex-1 flex items-center justify-center gap-[6px] py-[8px] rounded-[8px] text-[12px] transition-all duration-150 focus:outline-none"
                style={{
                  fontFamily: "Geist, sans-serif",
                  fontWeight: 600,
                  color: "white",
                  background: "#240046",
                  border: "1px solid #9d4edd",
                  boxShadow: "0 0 2px #9d4edd, 0 4px 12px rgba(123,44,191,0.3)",
                }}
              >
                <span className="shrink-0 size-[12px]"><TagIcon color="#c084fc" /></span>
                Tag & dismiss
              </button>
              <button
                onClick={() => setDismissed(true)}
                className="px-[12px] py-[8px] rounded-[8px] text-[12px] text-[#545458] transition-all duration-150 focus:outline-none hover:text-[#8e8e93]"
                style={{
                  fontFamily: "Geist, sans-serif",
                  fontWeight: 500,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                Skip
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Overlay Controls ─────────────────────────────────────────────────────────

const POSITION_OPTIONS = ["Top left", "Top right", "Bottom left", "Bottom right"];
const OPACITY_STEPS = [25, 50, 75, 100];

function PositionBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex-1 py-[7px] rounded-[8px] text-[12px] transition-all duration-150 focus:outline-none"
      style={{
        fontFamily: "Geist, sans-serif",
        fontWeight: active ? 600 : 400,
        color: active ? "white" : "#545458",
        background: active
          ? "#240046"
          : hovered
          ? "rgba(255,255,255,0.04)"
          : "transparent",
        border: `1px solid ${active ? "#9d4edd" : "rgba(255,255,255,0.05)"}`,
        boxShadow: active
          ? "0px 0px 2px #9d4edd, 3px 3px 12px rgba(123,44,191,0.2)"
          : "none",
      }}
    >
      {label}
    </button>
  );
}

function OpacityBtn({ value, active, onClick }: { value: number; active: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex-1 py-[7px] rounded-[8px] transition-all duration-150 focus:outline-none"
      style={{
        fontFamily: "Geist Mono, monospace",
        fontWeight: active ? 600 : 400,
        fontSize: 12,
        color: active ? "#9d4edd" : "#545458",
        background: active
          ? "rgba(157,78,221,0.08)"
          : hovered
          ? "rgba(255,255,255,0.04)"
          : "transparent",
        border: `1px solid ${active ? "rgba(157,78,221,0.35)" : "rgba(255,255,255,0.05)"}`,
      }}
    >
      {value}%
    </button>
  );
}

function OverlayControlsCard({
  overlayOn, onToggleOverlay,
  position, onPosition,
  opacity, onOpacity,
  onTagDeath, onClearSession,
  overlayStatus,
}: {
  overlayOn: boolean;
  onToggleOverlay: () => void;
  position: string;
  onPosition: (v: string) => void;
  opacity: number;
  onOpacity: (v: number) => void;
  onTagDeath: () => void;
  onClearSession: () => void;
  overlayStatus: StatusEntry | null;
}) {
  return (
    <div
      className="relative rounded-[16px] w-full shrink-0"
      style={{
        background: "#16161a",
        border: "1px solid rgba(255,255,255,0.05)",
        boxShadow: "4px 4px 8px rgba(0,0,0,0.31), -4px -4px 8px rgba(255,255,255,0.03)",
      }}
    >
      <div className="flex flex-col gap-[14px] p-[16px]">
        {/* Header row */}
        <div className="flex items-center justify-between w-full">
          <p className="text-[11px] text-[#8e8e93]" style={{ fontFamily: "Geist Mono, monospace", fontWeight: 700 }}>
            OVERLAY CONTROLS
          </p>
          <div className="flex gap-[10px] items-center">
            <p className="text-[12px] text-[#8e8e93] whitespace-nowrap" style={{ fontFamily: "Geist, sans-serif", fontWeight: 400 }}>
              Overlay active
            </p>
            <Switch on={overlayOn} onToggle={onToggleOverlay} />
          </div>
        </div>

        {/* Position + Opacity row */}
        <div className="flex gap-[24px] items-start w-full">
          {/* Position */}
          <div className="flex flex-col gap-[8px] flex-1">
            <p className="text-[10px] text-[#545458] tracking-[0.8px]" style={{ fontFamily: "Geist Mono, monospace", fontWeight: 600 }}>
              POSITION
            </p>
            <div className="flex gap-[6px]">
              {POSITION_OPTIONS.map((opt) => (
                <PositionBtn key={opt} label={opt} active={position === opt} onClick={() => onPosition(opt)} />
              ))}
            </div>
          </div>

          {/* Opacity */}
          <div className="flex flex-col gap-[8px] shrink-0 w-[180px]">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-[#545458] tracking-[0.8px]" style={{ fontFamily: "Geist Mono, monospace", fontWeight: 600 }}>
                OPACITY
              </p>
              <span className="text-[11px] tabular-nums" style={{ fontFamily: "Geist Mono, monospace", fontWeight: 600, color: "#9d4edd" }}>
                {opacity}%
              </span>
            </div>
            <div className="relative flex items-center" style={{ height: 20 }}>
              <div className="absolute inset-x-0 h-[4px] rounded-full" style={{ background: "rgba(255,255,255,0.06)" }} />
              <div
                className="absolute left-0 h-[4px] rounded-full"
                style={{ width: `${opacity}%`, background: "linear-gradient(90deg, #7b2cbf, #9d4edd)", boxShadow: "0 0 6px rgba(157,78,221,0.4)" }}
              />
              <input
                type="range"
                min={0}
                max={100}
                value={opacity}
                onChange={(e) => onOpacity(Number(e.target.value))}
                className="absolute inset-x-0 w-full opacity-0 cursor-pointer"
                style={{ height: 20 }}
              />
              <div
                className="absolute w-[12px] h-[12px] rounded-full border-2 bg-white"
                style={{
                  left: `calc(${opacity}% - 6px)`,
                  borderColor: "#9d4edd",
                  boxShadow: "0 0 6px rgba(157,78,221,0.5)",
                  pointerEvents: "none",
                }}
              />
            </div>
          </div>
        </div>

        {/* Action buttons + hotkey hint */}
        <div className="flex gap-[8px] items-center w-full">
          <div className="flex items-center gap-[8px]">
            <ActionBtn
              icon={<TagIcon color={overlayOn ? "#8E8E93" : "#444"} />}
              label="Manually tag"
              variant="purple"
              onClick={onTagDeath}
              disabled={!overlayOn}
            />
            <div
              className="px-[8px] py-[4px] rounded-[6px] text-[11px]"
              style={{
                fontFamily: "Geist Mono, monospace",
                fontWeight: 500,
                color: "#545458",
                background: "#0b0b0d",
                border: "1px solid rgba(255,255,255,0.07)",
                whiteSpace: "nowrap",
              }}
            >
              Alt+F3
            </div>
          </div>
          <ActionBtn
            icon={<TrashIcon />}
            label="Clear session"
            variant="danger"
            onClick={onClearSession}
          />
          <div className="ml-auto flex flex-col items-end gap-[4px]">
            <p className="text-[10px] text-[#545458] whitespace-nowrap" style={{ fontFamily: "Geist Mono, monospace", fontWeight: 400 }}>
              Toggle overlay
            </p>
            <div
              className="px-[10px] py-[4px] rounded-[6px] text-[11px] text-[#8e8e93]"
              style={{
                fontFamily: "Geist Mono, monospace",
                fontWeight: 500,
                background: "#0b0b0d",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              Ctrl+Shift+A
            </div>
          </div>
        </div>

        {/* Status */}
        {overlayStatus && <StatusBox entry={overlayStatus} />}
      </div>
    </div>
  );
}

// ─── Reset Confirm ────────────────────────────────────────────────────────────

function ResetConfirmModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div
        className="relative rounded-[20px] p-[28px] flex flex-col gap-[20px] w-[360px]"
        style={{
          background: "#16161a",
          border: "1px solid rgba(230,57,70,0.3)",
          boxShadow: "0 0 40px rgba(230,57,70,0.15)",
        }}
      >
        <div className="flex flex-col gap-[8px]">
          <p className="text-[17px] text-white font-semibold" style={{ fontFamily: "Geist, sans-serif", fontWeight: 700 }}>
            Reset all data?
          </p>
          <p className="text-[13px] text-[#8e8e93]" style={{ fontFamily: "Geist, sans-serif", fontWeight: 400 }}>
            This will permanently delete all your death tags and breakdown history. This action cannot be undone.
          </p>
        </div>
        <div className="flex gap-[10px]">
          <button
            onClick={onCancel}
            className="flex-1 py-[10px] rounded-[10px] text-[13px] text-[#8e8e93] transition-all duration-150 focus:outline-none"
            style={{
              background: "#0b0b0d",
              border: "1px solid rgba(255,255,255,0.07)",
              fontFamily: "Geist, sans-serif",
              fontWeight: 600,
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-[10px] rounded-[10px] text-[13px] text-white transition-all duration-150 focus:outline-none"
            style={{
              background: "rgba(255,77,109,0.15)",
              border: "1px solid rgba(230,57,70,0.5)",
              color: "#ff4d6d",
              fontFamily: "Geist, sans-serif",
              fontWeight: 600,
            }}
          >
            Reset everything
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

function getRoundMeta() {
  const rounds = ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "R10"];
  const sides = ["attack", "defense"];
  const r = rounds[Math.floor(Math.random() * rounds.length)];
  const s = sides[Math.floor(Math.random() * sides.length)];
  const now = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return `${r} · ${s} · ${now}`;
}

// ─── Flat small button ────────────────────────────────────────────────────────

function SmallBtn({ label, onClick, variant = "outline" }: { label: string; onClick?: () => void; variant?: "outline" | "danger" | "purple" }) {
  const [hovered, setHovered] = useState(false);
  const colors = {
    outline: { color: hovered ? "white" : "#8e8e93", border: hovered ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.1)", bg: hovered ? "rgba(255,255,255,0.05)" : "transparent" },
    danger:  { color: "#ff4d6d", border: "rgba(230,57,70,0.4)", bg: hovered ? "rgba(230,57,70,0.08)" : "transparent" },
    purple:  { color: "#9d4edd", border: "rgba(157,78,221,0.4)", bg: hovered ? "rgba(157,78,221,0.1)" : "transparent" },
  }[variant];
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="px-[10px] py-[4px] rounded-[6px] text-[11px] transition-all duration-100 focus:outline-none whitespace-nowrap"
      style={{ fontFamily: "Geist, sans-serif", fontWeight: 500, color: colors.color, border: `1px solid ${colors.border}`, background: colors.bg }}
    >
      {label}
    </button>
  );
}

// ─── Card shell ───────────────────────────────────────────────────────────────

const CardBg = { default: "#141416", mono: "#141414" };

function Card({ children, className = "", style, mono = false }: { children: React.ReactNode; className?: string; style?: React.CSSProperties; mono?: boolean }) {
  return (
    <div
      className={`relative w-full rounded-[14px] ${className}`}
      style={{ background: mono ? CardBg.mono : CardBg.default, border: "1px solid rgba(255,255,255,0.07)", transition: "background 0.3s ease", ...style }}
    >
      {children}
    </div>
  );
}

function CardLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] tracking-[1px]" style={{ fontFamily: "Geist Mono, monospace", fontWeight: 700, color: "#4a4a52" }}>
      {children}
    </p>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("overlay");

  // ── Settings-backed state ──────────────────────────────────────
  const _saved = settingsService.getAll();

  // Mock state
  const [mockOn, setMockOn] = useState<boolean>(() => settingsService.get('mockOn') ?? MOCK_MODE);
  const [status, setStatus] = useState<StatusEntry | null>(null);
  const [showReset, setShowReset] = useState(false);

  // Overlay state
  const [overlayOn, setOverlayOn] = useState<boolean>(() => settingsService.get('overlayOn') ?? true);
  const [overlayPosition, setOverlayPosition] = useState<string>(() => settingsService.get('overlayPosition') ?? 'Top right');
  const [overlayOpacity, setOverlayOpacity] = useState<number>(() => settingsService.get('overlayOpacity') ?? 75);
  const [overlayStatus, setOverlayStatus] = useState<StatusEntry | null>(null);

  // Detection AI state
  const [snapOn, setSnapOn] = useState<boolean>(() => settingsService.get('snapOn') ?? false);
  const [detectionMode, setDetectionMode] = useState<"Auto" | "Manual">(() => (settingsService.get('detectionMode') as "Auto" | "Manual") || "Auto");

  // Flaw Model Demo state
  const [modelLoaded, setModelLoaded] = useState(false);
  const [refCaptured, setRefCaptured] = useState(false);
  const [watchingRound, setWatchingRound] = useState(false);
  const [playerName, setPlayerName] = useState<string>(() => settingsService.get('playerName') ?? '');
  const [demoMsg, setDemoMsg] = useState("");
  const [demoResult, setDemoResult] = useState<{ flawName: string; flawType: string; confidence: number; severity: number } | null>(null);
  const refFrames = useRef<number[][] | null>(null);
  const watchTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchFrames = useRef<Float32Array[]>([]);
  const watchSource = useRef<CaptureSource>({ screenIndex: 0, source: "screen", sourceLabel: "Screen 1", mode: "screen" });
  const watchBusy = useRef(false);
  const watchStartedAt = useRef(0);
  const watchArmed = useRef(false);
  const [watchDiag, setWatchDiag] = useState("");

  // Shared state
  const [focus, setFocus] = useState("— clear —");
  const [tags, setTags] = useState<TagEntry[]>([]);
  const [matchActive, setMatchActive] = useState(false);
  const [matches, setMatches] = useState<MatchEntry[]>([]);
  const [realMatchResult, setRealMatchResult] = useState<"win" | "loss">("win");
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [autoStart, setAutoStart] = useState<boolean>(() => settingsService.get('autoStart') ?? false);
  const [theme, setTheme] = useState<"default" | "monochrome">(() => (settingsService.get('theme') as "default" | "monochrome") || "default");
  const [themeDropOpen, setThemeDropOpen] = useState(false);
  const themeDropRef = useRef<HTMLDivElement>(null);
  const [currentMap] = useState<string>(VALORANT_MAPS[0]);
  const matchIdRef = useRef(0);

  const deathCount = useRef(0);
  const tagsScrollRef = useRef<HTMLDivElement>(null);
  const breakdownScrollRef = useRef<HTMLDivElement>(null);

  // ── Sync real data (autopsyStore) into UI state ────────────────
  function refreshFromStore() {
    const entries = getAllEntries();
    const tagEntries: TagEntry[] = entries
      .filter((e: any) => e && !e.skipped && e.cause)
      .map((e: any) => ({ label: LABELS[e.cause] || e.cause, meta: getRoundMeta() }));
    setTags(tagEntries);

    const counts = getCauseCounts();
    const top = getTopCauses(1);
    setFocus(top[0]?.cause ? (LABELS[top[0].cause] || top[0].cause) : "— clear —");
  }

  useEffect(() => {
    refreshFromStore();
    eventBus.on('autopsy-saved', refreshFromStore);
    return () => eventBus.off('autopsy-saved', refreshFromStore);
  }, []);

  // ── Overlay position/opacity IPC on change ─────────────────────
  useEffect(() => {
    settingsService.set('overlayPosition', overlayPosition);
    window.electronAPI?.setOverlayPosition?.(overlayPosition.toLowerCase().replace(' ', '_'));
  }, [overlayPosition]);

  useEffect(() => {
    settingsService.set('overlayOpacity', overlayOpacity);
    window.electronAPI?.setOverlayOpacity?.(overlayOpacity);
  }, [overlayOpacity]);

  // ── Persist settings ───────────────────────────────────────────
  useEffect(() => { settingsService.set('overlayOn', overlayOn); }, [overlayOn]);
  useEffect(() => { settingsService.set('mockOn', mockOn); window.MOCK_MODE = mockOn; }, [mockOn]);
  useEffect(() => { settingsService.set('theme', theme); }, [theme]);
  useEffect(() => { settingsService.set('autoStart', autoStart); }, [autoStart]);
  useEffect(() => { settingsService.set('snapOn', snapOn); }, [snapOn]);
  useEffect(() => { settingsService.set('detectionMode', detectionMode); }, [detectionMode]);

  // ── Detect Valorant open/close → tray ──────────────────────────
  useEffect(() => {
    deathDetector.onValorantState((isOpen) => {
      if (isOpen) window.electronAPI?.hideToTray?.();
      else window.electronAPI?.showFromTray?.();
    });
    return () => { deathDetector.onValorantState(() => {}); };
  }, []);

  // ── Auto-detect death → save + show overlay ────────────────────
  useEffect(() => {
    deathDetector.onAutoDetect((result) => {
      if (result.state !== 'death_confirmed' || result.confidence < 0.3) return;
      const cause = 'crosshair_placement';
      const detectedScore = result.score;
      simulateTag(cause);
      if (overlayOn) {
        window.electronAPI?.sendDeathEvent?.({ source: 'snapshot', timestamp: Date.now(), cause, round: detectedScore || 1 });
        window.electronAPI?.showOverlay?.({ position: overlayPosition.toLowerCase().replace(' ', '_'), opacity: overlayOpacity });
      }
    });
    return () => { deathDetector.onAutoDetect(() => {}); };
  }, [overlayOn, overlayPosition, overlayOpacity]);

  // ── Resume Detection AI from saved settings on launch ─────────
  useEffect(() => {
    if (detectionMode === "Auto") deathDetector.startWatching();
    if (snapOn) {
      deathDetector.detectValorantScreen().then(() => {
        deathDetector.startSnapping();
      });
    }
    return () => {
      deathDetector.stopWatching();
      deathDetector.stopSnapping();
    };
  }, []);

  // ── Mock handlers ──────────────────────────────────────────────
  function handleSimulateDeath() {
    if (!mockOn) return;
    deathCount.current += 1;
    setMatchActive(true);
    const payload = simulateDeath();
    setStatus({ icon: "skull", message: "Death simulated —", highlight: "overlay shown", suffix: ` (${deathCount.current * 6}s total)` });
    if (overlayOn) {
      window.electronAPI?.sendDeathEvent?.({ ...payload, source: 'mock' });
      window.electronAPI?.showOverlay?.({ position: overlayPosition.toLowerCase().replace(' ', '_'), opacity: overlayOpacity });
    }
  }

  function handleSimulateTag() {
    if (!mockOn) return;
    const cause = DEATH_CAUSES[Math.floor(Math.random() * DEATH_CAUSES.length)];
    simulateTag(cause);
    const meta = getRoundMeta();
    setMatchActive(true);
    setTags((prev) => [...prev, { label: cause, meta }]);
    setStatus({ icon: "tag", message: "Death tagged —", highlight: cause, suffix: "" });
    setTimeout(() => {
      if (tagsScrollRef.current) tagsScrollRef.current.scrollTop = tagsScrollRef.current.scrollHeight;
    }, 50);
  }

  function handleEndMatch() {
    setMatchActive(false);
    const summary = endMockMatch();
    setStatus({ icon: "stop", message: "Mock match ended —", highlight: `${summary.taggedCount} tags recorded`, suffix: "" });
    if (tags.length > 0) {
      matchIdRef.current += 1;
      const timestamp = new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
      setMatches((prev) => [{ id: matchIdRef.current, type: "mock", timestamp, tags: [...tags], map: currentMap }, ...prev]);
      setTags([]);
      deathCount.current = 0;
      refreshFromStore();
    }
  }

  function handleReset() {
    setShowReset(true);
  }

  function confirmReset() {
    clearAllData();
    setTags([]);
    setStatus(null);
    setMatchActive(false);
    setFocus("— clear —");
    deathCount.current = 0;
    setShowReset(false);
  }

  function handleOverlayTagDeath() {
    if (!overlayOn) return;
    const cause = DEATH_CAUSES[Math.floor(Math.random() * DEATH_CAUSES.length)];
    simulateTag(cause);
    const meta = getRoundMeta();
    setTags((prev) => [...prev, { label: cause, meta }]);
    setOverlayStatus({ icon: "tag", message: "Death tagged —", highlight: cause, suffix: "" });
    setTimeout(() => {
      if (tagsScrollRef.current) tagsScrollRef.current.scrollTop = tagsScrollRef.current.scrollHeight;
    }, 50);
  }

  function handleOverlayClearSession() {
    setTags([]);
    setOverlayStatus({ icon: "stop", message: "Session cleared —", highlight: "all tags removed", suffix: "" });
  }

  function handleOverlayToggle() {
    setOverlayOn((v) => {
      const next = !v;
      setOverlayStatus(next
        ? { icon: "skull", message: "Overlay enabled —", highlight: overlayPosition.toLowerCase(), suffix: ` · ${overlayOpacity}%` }
        : { icon: "stop", message: "Overlay hidden —", highlight: "press Ctrl+Shift+A to restore", suffix: "" }
      );
      if (next) window.electronAPI?.showOverlay?.({ position: overlayPosition.toLowerCase().replace(' ', '_'), opacity: overlayOpacity });
      else window.electronAPI?.hideOverlay?.();
      return next;
    });
  }

  // ── Flaw Model Demo handlers ───────────────────────────────────
  function stopWatchingDemo() {
    if (watchTimer.current) { clearInterval(watchTimer.current); watchTimer.current = null; }
    watchBusy.current = false;
    setWatchingRound(false);
    setWatchDiag("");
  }
  useEffect(() => () => stopWatchingDemo(), []);

  async function handleLoadModel() {
    setDemoMsg("Loading model…");
    try {
      const res = await window.electronAPI?.loadModel?.();
      if (res?.success) {
        setModelLoaded(true);
        setDemoMsg(`Model ready — ${res.flawTypes?.length || 0} flaw types`);
      } else {
        setDemoMsg(res?.error || "Failed to load model");
      }
    } catch (e: any) { setDemoMsg(String(e?.message || e)); }
  }

  async function handleCaptureReference() {
    setDemoMsg("Capturing reference clip…");
    try {
      const src = await resolveCaptureSource();
      watchSource.current = src;
      const frames = await captureClip(src);
      refFrames.current = frames.map((f) => Array.from(f));
      setRefCaptured(true);
      setDemoResult(null);
      setDemoMsg(`Reference captured — ${frames.length} frames (${src.sourceLabel})`);
    } catch (e: any) { setDemoMsg(String(e?.message || e)); }
  }

  async function runDeathAnalysis() {
    const frames = watchFrames.current;
    const src = watchSource.current;
    if (!refFrames.current || frames.length < 3) {
      setDemoMsg(frames.length < 3 ? "Not enough frames captured before death" : "Capture a reference clip first");
      return;
    }
    setDemoMsg("Death detected — analyzing clip…");
    try {
      const res = await window.electronAPI?.detectFlaw?.({
        flawedFrames: frames.map((f) => Array.from(f)),
        flawlessFrames: refFrames.current,
      });
      if (res?.success) {
        setDemoResult({
          flawName: res.flawName || res.flawType || "UNKNOWN",
          flawType: res.flawType || "UNKNOWN",
          confidence: res.confidence ?? 0,
          severity: res.severity ?? 0,
        });
        setDemoMsg(`Detected ${res.flawName || res.flawType} (${((res.confidence ?? 0) * 100).toFixed(1)}%) · ${src.sourceLabel}`);
      } else {
        setDemoMsg(res?.error || "Analysis failed");
      }
    } catch (e: any) { setDemoMsg(String(e?.message || e)); }
  }

  async function handleWatchRound() {
    if (watchingRound) { stopWatchingDemo(); setDemoMsg("Round watch stopped"); return; }
    if (!refFrames.current) { setDemoMsg("Capture a reference clip first"); return; }

    const src = await resolveCaptureSource();
    watchSource.current = src;
    watchFrames.current = [];
    watchBusy.current = false;
    watchArmed.current = false;
    watchStartedAt.current = Date.now();
    setDemoResult(null);
    setWatchingRound(true);
    setDemoMsg(`Watching round… waiting for feed to clear (${src.sourceLabel})`);

    const WATCH_INTERVAL = 100, WARMUP_MS = 800, FORCE_ARM_MS = 5000;
    watchTimer.current = setInterval(async () => {
      if (watchBusy.current) return;
      watchBusy.current = true;
      try {
        const res = await captureFrame(watchSource.current);
        if (!res.success || !res.dataUrl) { watchBusy.current = false; return; }

        const norm = await dataUrlToNormFrame(res.dataUrl);
        watchFrames.current.push(norm);
        if (watchFrames.current.length > NUM_FRAMES) watchFrames.current.shift();

        const det: DetectionResult = await deathDetector.analyzeFrame(res.dataUrl);
        const elapsed = Date.now() - watchStartedAt.current;

        if (elapsed < WARMUP_MS) {
          // warm-up
        } else if (det.state === 'death_confirmed' && det.confidence >= 0.6) {
          if (watchArmed.current) {
            stopWatchingDemo();
            await runDeathAnalysis();
            watchBusy.current = false;
            return;
          }
        } else {
          if (!watchArmed.current) {
            watchArmed.current = true;
            setDemoMsg(`Watching round… armed, waiting for your death (${watchSource.current.sourceLabel})`);
          }
        }
        if (!watchArmed.current && elapsed >= FORCE_ARM_MS) {
          watchArmed.current = true;
          setDemoMsg(`Watching round… armed (forced), waiting for your death (${watchSource.current.sourceLabel})`);
        }
        if (watchArmed.current) setWatchDiag(det.detail || "");
      } catch {}
      watchBusy.current = false;
    }, WATCH_INTERVAL);
  }

  function handlePlayerNameChange(v: string) {
    setPlayerName(v);
    settingsService.set('playerName', v);
    deathDetector.setPlayerName(v);
  }

  // ── Detection AI handlers ──────────────────────────────────────
  function toggleSnap() {
    setSnapOn((v) => {
      const next = !v;
      if (next) {
        // Detect the capture source first — startSnapping then runs at 60fps
        // only when a Valorant/video window is found, otherwise idles at 1fps
        // so the app stays responsive.
        deathDetector.detectValorantScreen().then(() => {
          deathDetector.startSnapping();
        });
      } else {
        deathDetector.stopSnapping();
      }
      return next;
    });
  }

  function handleDetectionMode(mode: "Auto" | "Manual") {
    setDetectionMode(mode);
    if (mode === "Auto") deathDetector.startWatching();
    else deathDetector.stopWatching();
  }

  function resetDetection() {
    deathDetector.stopSnapping();
    deathDetector.stopWatching();
    setSnapOn(false);
  }

  // ── Settings handlers ──────────────────────────────────────────
  const focusLabel = focus === "— clear —" ? "No focus set" : focus;

  const mono: React.CSSProperties = theme === "monochrome"
    ? { filter: "grayscale(1) contrast(1.05)", transition: "filter 0.3s ease" }
    : { transition: "filter 0.3s ease" };

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (themeDropRef.current && !themeDropRef.current.contains(e.target as Node)) setThemeDropOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const TAB_PAGES: { id: Tab; label: string; sub: string; icon: React.ReactNode }[] = [
    { id: "overlay", label: "Overlay", sub: "Ctrl+Shift+A", icon: <Monitor size={15} /> },
    { id: "mock", label: "Mock", sub: "Ctrl+Shift+D", icon: <FlaskConical size={15} /> },
    { id: "recent-matches", label: "Recent Matches", sub: "", icon: null },
  ];

  return (
    <div className="relative" data-theme={theme} style={{ width: 1058, height: 639, background: "#060608", overflow: "hidden" }}>
      <div style={{ transform: "scale(1.15)", transformOrigin: "top left", width: 920, height: 555, display: "flex", flexDirection: "column", background: "#0c0c0e", borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 32px 96px rgba(0,0,0,0.9)" }}>

        {/* ── Title bar ── */}
        <div className="flex items-center justify-between px-[14px] shrink-0" style={{ height: 38, background: "#0a0a0c", borderBottom: "1px solid rgba(255,255,255,0.06)", ...mono, WebkitAppRegion: "drag" } as React.CSSProperties}>
          <div className="flex items-center gap-[8px]">
            <img src={appIcon} alt="" style={{ width: 20, height: 20, display: "block", objectFit: "contain" }} />
          </div>
          <div className="flex items-center gap-[6px]" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
            <button onClick={() => window.electronAPI?.minimizeWindow?.()} className="flex items-center justify-center w-[28px] h-[20px] rounded-[4px] text-[#545458] hover:text-white hover:bg-white/5 transition-all focus:outline-none text-[14px]">−</button>
            <button onClick={() => window.electronAPI?.closeWindow?.()} className="flex items-center justify-center w-[28px] h-[20px] rounded-[4px] text-[#545458] hover:text-[#ff4d6d] hover:bg-[rgba(255,77,109,0.08)] transition-all focus:outline-none text-[13px]">×</button>
          </div>
        </div>

        {/* ── Body (sidebar + main) ── */}
        <div className="flex flex-1 min-h-0">

          {/* ── Sidebar ── */}
          <div className="flex flex-col shrink-0 py-[20px] min-h-0 overflow-hidden" style={{ width: 210, background: "#0a0a0c", borderRight: "1px solid rgba(255,255,255,0.05)", ...mono }}>
            {/* Branding */}
            <div className="flex items-center justify-between px-[16px] mb-[24px]">
              <div>
                <p className="text-[15px] text-white" style={{ fontFamily: "Geist, sans-serif", fontWeight: 700, letterSpacing: "-0.01em" }}>Leakling</p>
                <p className="text-[9px] tracking-[1.2px] mt-[2px]" style={{ fontFamily: "Geist Mono, monospace", fontWeight: 600, color: "#3a3a42" }}>DESKTOP</p>
              </div>
              <button
                onClick={() => setActiveTab(activeTab === "settings" ? "overlay" : "settings")}
                className="flex items-center justify-center w-[28px] h-[28px] rounded-[8px] transition-all duration-150 focus:outline-none"
                style={{
                  color: activeTab === "settings" ? "#9d4edd" : "#3a3a42",
                  background: activeTab === "settings" ? "rgba(157,78,221,0.1)" : "transparent",
                  border: `1px solid ${activeTab === "settings" ? "rgba(157,78,221,0.25)" : "transparent"}`,
                }}
                onMouseEnter={(e) => { if (activeTab !== "settings") { (e.currentTarget as HTMLButtonElement).style.color = "#545458"; } }}
                onMouseLeave={(e) => { if (activeTab !== "settings") { (e.currentTarget as HTMLButtonElement).style.color = "#3a3a42"; } }}
              >
                <Settings size={14} />
              </button>
            </div>

            {/* Pages */}
            <div className="px-[10px] mb-[4px]">
              <p className="text-[9px] tracking-[1px] px-[10px] mb-[4px]" style={{ fontFamily: "Geist Mono, monospace", fontWeight: 700, color: "#3a3a42" }}>PAGES</p>
              {TAB_PAGES.map((page) => {
                const active = activeTab === page.id;
                return (
                  <button
                    key={page.id}
                    onClick={() => setActiveTab(page.id)}
                    className="w-full flex items-center px-[10px] py-[7px] rounded-[8px] transition-all duration-150 focus:outline-none"
                    style={{ background: active ? "rgba(157,78,221,0.1)" : "transparent", border: `1px solid ${active ? "rgba(157,78,221,0.25)" : "transparent"}` }}
                  >
                    <div className="flex flex-col items-start gap-[1px] min-w-0">
                      <span className="text-[13px] leading-none" style={{ fontFamily: "Geist, sans-serif", fontWeight: active ? 600 : 400, color: active ? "white" : "#545458" }}>{page.label}</span>
                      <span className="text-[10px] leading-none" style={{ fontFamily: "Geist Mono, monospace", color: "#2e2e36" }}>{page.sub}</span>
                    </div>
                    {active && <div className="ml-auto w-[5px] h-[5px] rounded-full shrink-0" style={{ background: "#9d4edd", boxShadow: "0 0 6px #9d4edd" }} />}
                  </button>
                );
              })}
            </div>

            <div className="mx-[16px] my-[14px]" style={{ height: 1, background: "rgba(255,255,255,0.05)" }} />

            {/* Session stats */}
            <div className="px-[10px] mb-[4px]">
              <p className="text-[9px] tracking-[1px] px-[10px] mb-[8px]" style={{ fontFamily: "Geist Mono, monospace", fontWeight: 700, color: "#3a3a42" }}>SESSION</p>
              <div className="flex flex-col gap-[6px] px-[10px]">
                {[
                  { label: "Deaths tagged", value: tags.length },
                  { label: "Causes tracked", value: new Set(tags.map(t => t.label)).size },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-[11px]" style={{ fontFamily: "Geist, sans-serif", color: "#3a3a42" }}>{label}</span>
                    <span className="text-[11px]" style={{ fontFamily: "Geist Mono, monospace", fontWeight: 600, color: "#545458" }}>{value}</span>
                  </div>
                ))}
                <div className="flex items-start justify-between gap-[8px]">
                  <span className="text-[11px] shrink-0" style={{ fontFamily: "Geist, sans-serif", color: "#3a3a42" }}>Focus</span>
                  <span className="text-[11px] text-right leading-[1.3]" style={{ fontFamily: "Geist Mono, monospace", fontWeight: 600, color: focus === "— clear —" ? "#2e2e36" : "#9d4edd", wordBreak: "break-word" }}>
                    {focus === "— clear —" ? "none" : focus}
                  </span>
                </div>
              </div>
            </div>

            <div className="mx-[16px] my-[14px]" style={{ height: 1, background: "rgba(255,255,255,0.05)" }} />

            {/* Recent Tags */}
            <div className="px-[10px] flex flex-col flex-1 min-h-0">
              <p className="text-[9px] tracking-[1px] px-[10px] mb-[6px]" style={{ fontFamily: "Geist Mono, monospace", fontWeight: 700, color: "#3a3a42" }}>RECENT TAGS</p>
              <div ref={tagsScrollRef} className="leakling-scroll flex flex-col gap-[2px] overflow-y-auto flex-1">
                {tags.length === 0
                  ? <p className="text-[11px] px-[10px]" style={{ fontFamily: "Geist, sans-serif", color: "#2e2e36" }}>No tags yet</p>
                  : [...tags].reverse().map((t, i) => (
                    <div key={i} className="flex items-center justify-between px-[10px] py-[6px] rounded-[6px]" style={{ background: i === 0 ? "rgba(255,255,255,0.03)" : "transparent" }}>
                      <div className="flex items-center gap-[7px] min-w-0">
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: i === 0 ? "#9d4edd" : "#2a2a30", flexShrink: 0 }} />
                        <span className="text-[11px] truncate" style={{ fontFamily: "Geist, sans-serif", color: i === 0 ? "#8e8e93" : "#3a3a42" }}>{t.label}</span>
                      </div>
                      <span className="text-[9px] shrink-0 ml-[4px]" style={{ fontFamily: "Geist Mono, monospace", color: "#2e2e36" }}>{t.meta.split(" · ")[0]}</span>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>

          {/* ── Main content ── */}
          <div className="flex flex-col flex-1 min-w-0" style={{ background: theme === "monochrome" ? "#0f0f0f" : "#0f0f12", transition: "background 0.3s ease" }}>
            {/* Cards */}
            <div className="leakling-scroll flex flex-col gap-[14px] p-[20px] overflow-y-auto flex-1">

              {/* Tab-specific controls */}
              {activeTab === "settings" ? (
                <div style={mono} className="flex flex-col gap-[14px] flex-1">
                <Card className="flex-1">
                  <div className="flex flex-col gap-[0px] p-[18px] h-full">
                    <CardLabel>SETTINGS</CardLabel>

                    <div className="flex flex-col gap-[0px] mt-[16px]">
                      {/* Auto start */}
                      <div
                        className="flex items-center justify-between py-[14px]"
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                      >
                        <div className="flex flex-col gap-[3px]">
                          <span className="text-[13px] text-white" style={{ fontFamily: "Geist, sans-serif", fontWeight: 500 }}>Auto start on PC startup</span>
                          <span className="text-[11px]" style={{ fontFamily: "Geist, sans-serif", color: "#3a3a42" }}>Launch Leakling automatically when Windows starts</span>
                        </div>
                        <Switch on={autoStart} onToggle={() => setAutoStart(v => !v)} />
                      </div>

                      {/* Theme */}
                      <div className="flex items-center justify-between py-[14px]">
                        <div className="flex flex-col gap-[3px]">
                          <span className="text-[13px] text-white" style={{ fontFamily: "Geist, sans-serif", fontWeight: 500 }}>Theme</span>
                          <span className="text-[11px]" style={{ fontFamily: "Geist, sans-serif", color: "#3a3a42" }}>Choose a colour theme for the interface</span>
                        </div>
                        <div ref={themeDropRef} className="relative">
                          <button
                            onClick={() => setThemeDropOpen(o => !o)}
                            className="flex items-center gap-[12px] px-[12px] py-[7px] rounded-[8px] transition-all duration-150 focus:outline-none"
                            style={{ background: "#0b0b0d", border: "1px solid rgba(255,255,255,0.08)", minWidth: 130 }}
                          >
                            <span className="flex-1 text-left text-[12px] text-white capitalize" style={{ fontFamily: "Geist Mono, monospace", fontWeight: 500 }}>{theme}</span>
                            <span className="shrink-0 size-[12px]"><ChevronIcon open={themeDropOpen} /></span>
                          </button>
                          {themeDropOpen && (
                            <div
                              className="absolute right-0 top-[calc(100%+6px)] z-50 w-full rounded-[10px] overflow-hidden py-[4px]"
                              style={{ background: "#0b0b0d", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 8px 24px rgba(0,0,0,0.6)" }}
                            >
                              {(["default", "monochrome"] as const).map((opt) => (
                                <button
                                  key={opt}
                                  onClick={() => { setTheme(opt); setThemeDropOpen(false); }}
                                  className="w-full text-left px-[12px] py-[8px] text-[12px] capitalize transition-colors duration-100 focus:outline-none"
                                  style={{
                                    fontFamily: "Geist Mono, monospace",
                                    fontWeight: 500,
                                    color: opt === theme ? "#9d4edd" : "white",
                                    background: opt === theme ? "rgba(157,78,221,0.08)" : "transparent",
                                  }}
                                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)"; }}
                                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = opt === theme ? "rgba(157,78,221,0.08)" : "transparent"; }}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
                </div>
              ) : activeTab === "recent-matches" ? (
                <div className="flex flex-col gap-[10px]">
                  {/* Real match logger */}
                  <Card mono={theme === "monochrome"}>
                    <div className="flex flex-col gap-[12px] p-[16px]">
                      <CardLabel>LOG REAL MATCH</CardLabel>
                      <div className="flex items-center gap-[8px]">
                        {/* Win / Loss toggle */}
                        <button
                          onClick={() => setRealMatchResult("win")}
                          className="flex-1 py-[7px] rounded-[8px] text-[12px] font-semibold transition-all duration-150 focus:outline-none"
                          style={{
                            fontFamily: "Geist, sans-serif",
                            color: realMatchResult === "win" ? "white" : "#3a3a42",
                            background: realMatchResult === "win" ? "rgba(34,197,94,0.12)" : "transparent",
                            border: `1px solid ${realMatchResult === "win" ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.06)"}`,
                            boxShadow: realMatchResult === "win" ? "0 0 8px rgba(34,197,94,0.15)" : "none",
                          }}
                        >
                          Win
                        </button>
                        <button
                          onClick={() => setRealMatchResult("loss")}
                          className="flex-1 py-[7px] rounded-[8px] text-[12px] font-semibold transition-all duration-150 focus:outline-none"
                          style={{
                            fontFamily: "Geist, sans-serif",
                            color: realMatchResult === "loss" ? "white" : "#3a3a42",
                            background: realMatchResult === "loss" ? "rgba(239,68,68,0.12)" : "transparent",
                            border: `1px solid ${realMatchResult === "loss" ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.06)"}`,
                            boxShadow: realMatchResult === "loss" ? "0 0 8px rgba(239,68,68,0.15)" : "none",
                          }}
                        >
                          Loss
                        </button>
                        <button
                          onClick={() => {
                            matchIdRef.current += 1;
                            const timestamp = new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
                            setMatches((prev) => [{ id: matchIdRef.current, type: "real", result: realMatchResult, timestamp, tags: [...tags], map: currentMap }, ...prev]);
                          }}
                          className="px-[16px] py-[7px] rounded-[8px] text-[12px] font-semibold transition-all duration-150 focus:outline-none"
                          style={{
                            fontFamily: "Geist, sans-serif",
                            color: "white",
                            background: realMatchResult === "win" ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.18)",
                            border: `1px solid ${realMatchResult === "win" ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.5)"}`,
                            boxShadow: realMatchResult === "win" ? "0 0 10px rgba(34,197,94,0.15)" : "0 0 10px rgba(239,68,68,0.15)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          End match
                        </button>
                      </div>
                    </div>
                  </Card>

                  {matches.length === 0 ? (
                    <Card mono={theme === "monochrome"}>
                      <div className="flex flex-col gap-[6px] p-[18px]">
                        <CardLabel>HISTORY</CardLabel>
                        <p className="text-[13px] mt-[4px]" style={{ fontFamily: "Geist, sans-serif", color: "#3a3a42" }}>
                          No matches yet. End a mock or real session to log it here.
                        </p>
                      </div>
                    </Card>
                  ) : matches.map((match) => {
                    const isMock = match.type === "mock";
                    const isWin = match.result === "win";
                    const accentColor = isMock ? "#9d4edd" : isWin ? "#22c55e" : "#ef4444";
                    const bgColor = isMock ? "rgba(157,78,221,0.05)" : isWin ? "rgba(34,197,94,0.04)" : "rgba(239,68,68,0.04)";
                    const borderColor = isMock ? "rgba(157,78,221,0.18)" : isWin ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)";
                    const isSelected = selectedMatchId === match.id;
                    return (
                      <div
                        key={match.id}
                        onClick={() => setSelectedMatchId(isSelected ? null : match.id)}
                        className="relative w-full rounded-[14px] overflow-hidden cursor-pointer transition-all duration-150"
                        style={{
                          background: bgColor,
                          border: `1px solid ${isSelected ? accentColor : borderColor}`,
                          boxShadow: isSelected ? `0 0 0 1px ${accentColor}40` : "none",
                        }}
                      >
                        {/* left accent */}
                        <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-[14px]" style={{ background: accentColor }} />
                        <div className="flex flex-col gap-[12px] pl-[20px] pr-[16px] py-[14px]">
                          {/* header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-[8px]">
                              <span
                                className="px-[7px] py-[2px] rounded-full text-[9px] tracking-[0.8px]"
                                style={{ fontFamily: "Geist Mono, monospace", fontWeight: 700, color: accentColor, background: `${accentColor}18`, border: `1px solid ${accentColor}40` }}
                              >
                                {isMock ? "MOCK" : isWin ? "WIN" : "LOSS"}
                              </span>
                              <span className="text-[13px]" style={{ fontFamily: "Geist, sans-serif", fontWeight: 600, color: "#8e8e93" }}>
                                {match.map}
                              </span>
                            </div>
                            <span className="text-[10px]" style={{ fontFamily: "Geist Mono, monospace", color: "#3a3a42" }}>{match.timestamp}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : activeTab === "overlay" ? (
                <div style={mono} className="flex flex-col gap-[14px]">
                <OverlayControlsCard
                  overlayOn={overlayOn}
                  onToggleOverlay={handleOverlayToggle}
                  position={overlayPosition}
                  onPosition={setOverlayPosition}
                  opacity={overlayOpacity}
                  onOpacity={setOverlayOpacity}
                  onTagDeath={handleOverlayTagDeath}
                  onClearSession={handleOverlayClearSession}
                  overlayStatus={overlayStatus}
                />
                </div>
              ) : (<div style={mono} className="flex flex-col gap-[14px]"><>
                {/* Mock Controls */}
                <Card>
                  <div className="flex flex-col gap-[14px] p-[18px]">
                    <div className="flex items-center justify-between">
                      <CardLabel>MOCK CONTROLS</CardLabel>
                      <div className="flex items-center gap-[10px]">
                        <span className="text-[12px]" style={{ fontFamily: "Geist, sans-serif", color: "#545458" }}>Mock mode</span>
                        <Switch on={mockOn} onToggle={() => setMockOn((v) => !v)} />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-[8px]">
                      <ActionBtn icon={<MockSkullIcon color={mockOn ? "white" : "#555"} />} label="Simulate death" variant="purple" onClick={handleSimulateDeath} disabled={!mockOn} />
                      <ActionBtn icon={<TagIcon color={mockOn ? "#8E8E93" : "#444"} />} label="Simulate + tag" variant="neutral" onClick={handleSimulateTag} disabled={!mockOn} />
                      <ActionBtn icon={<StopIcon color={matchActive ? "#8E8E93" : "#444"} />} label="End mock match" variant="neutral" onClick={handleEndMatch} disabled={!matchActive} />
                      <ActionBtn icon={<TrashIcon />} label="Reset all data" variant="danger" onClick={handleReset} />
                    </div>
                    {status && <StatusBox entry={status} />}
                  </div>
                </Card>

                {/* Flaw Model Demo */}
                <Card>
                  <div className="flex flex-col gap-[14px] p-[18px]">
                    <div className="flex items-center justify-between">
                      <CardLabel>FLAW MODEL DEMO</CardLabel>
                      <div className="flex items-center gap-[6px]">
                        {[{ label: modelLoaded ? "Model on" : "Model off", active: modelLoaded }, { label: refCaptured ? "Ref captured" : "No ref", active: refCaptured }].map(({ label, active }) => (
                          <div key={label} className="flex items-center gap-[5px] px-[8px] py-[3px] rounded-full text-[10px]" style={{ fontFamily: "Geist Mono, monospace", color: active ? "#9d4edd" : "#545458", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
                            <span style={{ width: 5, height: 5, borderRadius: "50%", background: active ? "#9d4edd" : "#2a2a30", display: "inline-block" }} />
                            {label}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-[8px] flex-wrap">
                      <ActionBtn label={modelLoaded ? "Model loaded" : "Load model"} variant={modelLoaded ? "neutral" : "purple"} onClick={handleLoadModel} />
                      <ActionBtn label="Capture reference" variant="neutral" onClick={handleCaptureReference} disabled={!modelLoaded} />
                      <ActionBtn label={watchingRound ? "Stop watching" : "Watch round"} variant={watchingRound ? "neutral" : "purple"} onClick={handleWatchRound} disabled={!modelLoaded || !refCaptured} />
                    </div>
                    <div className="flex flex-col gap-[6px]">
                      <label className="text-[11px]" style={{ fontFamily: "Geist, sans-serif", color: "#545458" }}>Your name <span style={{ color: "#2e2e36" }}>(OCR confirm)</span></label>
                      <input value={playerName} onChange={(e) => handlePlayerNameChange(e.target.value)} placeholder="enter your in-game name"
                        className="w-full px-[12px] py-[8px] rounded-[8px] text-[12px] focus:outline-none"
                        style={{ fontFamily: "Geist Mono, monospace", background: "#0a0a0c", border: "1px solid rgba(255,255,255,0.08)", color: "white" }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(157,78,221,0.4)"; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
                      />
                    </div>
                    {(demoMsg || demoResult || (watchingRound && watchDiag)) && (
                      <div className="flex flex-col gap-[6px] w-full">
                        {demoResult && (
                          <div className="flex items-center justify-between rounded-[10px] px-[12px] py-[10px]"
                            style={{ background: "rgba(157,78,221,0.08)", border: "1px solid rgba(157,78,221,0.25)" }}>
                            <div className="flex flex-col gap-[2px]">
                              <span className="text-[13px] text-white" style={{ fontFamily: "Geist, sans-serif", fontWeight: 700 }}>{demoResult.flawName}</span>
                              <span className="text-[10px] text-[#8e8e93]" style={{ fontFamily: "Geist Mono, monospace" }}>
                                {demoResult.flawType} · {((demoResult.confidence ?? 0) * 100).toFixed(1)}% · sev {demoResult.severity.toFixed(2)}
                              </span>
                            </div>
                            <span className="text-[18px]">{demoResult.severity > 0.6 ? "🔴" : demoResult.severity > 0.3 ? "🟡" : "🟢"}</span>
                          </div>
                        )}
                        {demoMsg && <p className="text-[11px]" style={{ fontFamily: "Geist Mono, monospace", color: "#8e8e93" }}>{demoMsg}</p>}
                        {watchingRound && watchDiag && <p className="text-[10px] truncate" style={{ fontFamily: "Geist Mono, monospace", color: "#545458" }}>{watchDiag}</p>}
                      </div>
                    )}
                  </div>
                </Card>
              </></div>)}

              {/* Bottom row — hidden on settings */}
              {activeTab !== "settings" && <div className="flex gap-[14px] w-full" style={{ height: 160, minHeight: 160, ...mono }}>
                <Card className="flex-1 min-w-0">
                  <div className="flex flex-col gap-[12px] p-[18px] h-full overflow-hidden">
                    {(() => {
                      const selectedMatch = activeTab === "recent-matches" && selectedMatchId !== null
                        ? matches.find(m => m.id === selectedMatchId) ?? null
                        : null;
                      const breakdownTags = selectedMatch ? selectedMatch.tags : tags;
                      const isMockMatch = selectedMatch?.type === "mock";
                      const isWinMatch = selectedMatch?.result === "win";
                      const accentBreakdown = selectedMatch
                        ? isMockMatch ? "#9d4edd" : isWinMatch ? "#22c55e" : "#ef4444"
                        : "#9d4edd";
                      return (<>
                        <div className="flex items-center justify-between">
                          <CardLabel>CAUSE BREAKDOWN</CardLabel>
                          {selectedMatch && (
                            <span className="text-[9px] tracking-[0.6px]" style={{ fontFamily: "Geist Mono, monospace", fontWeight: 600, color: accentBreakdown }}>
                              {selectedMatch.map.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div ref={breakdownScrollRef} className="flex-1 w-full overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                          <CauseBreakdown tags={breakdownTags} accentColor={accentBreakdown} />
                        </div>
                      </>);
                    })()}
                  </div>
                </Card>

                {activeTab === "overlay" && (
                  <Card style={{ width: 220 }} className="shrink-0 overflow-hidden">
                    <div className="flex flex-col gap-[10px] p-[14px] h-full">
                      <div className="flex items-center justify-between">
                        <CardLabel>DETECTION AI</CardLabel>
                        <SmallBtn label={snapOn ? "⟳ On" : "⟳ Off"} onClick={toggleSnap} variant={snapOn ? "purple" : "outline"} />
                      </div>
                      <div className="flex gap-[5px]">
                        {(["Auto", "Manual"] as const).map((mode) => {
                          const active = detectionMode === mode;
                          return (
                            <button
                              key={mode}
                              onClick={() => handleDetectionMode(mode)}
                              className="flex-1 py-[5px] rounded-[7px] text-[11px] transition-all duration-150 focus:outline-none"
                              style={{
                                fontFamily: "Geist Mono, monospace",
                                fontWeight: active ? 600 : 400,
                                color: active ? "#9d4edd" : "#545458",
                                background: active ? "rgba(157,78,221,0.08)" : "transparent",
                                border: `1px solid ${active ? "rgba(157,78,221,0.35)" : "rgba(255,255,255,0.05)"}`,
                              }}
                            >
                              {mode}
                            </button>
                          );
                        })}
                      </div>
                      <button
                        onClick={resetDetection}
                        className="w-full flex-1 rounded-[8px] text-[11px] transition-all duration-150 focus:outline-none mt-auto"
                        style={{
                          fontFamily: "Geist, sans-serif",
                          fontWeight: 600,
                          color: "#ff4d6d",
                          background: "rgba(239,68,68,0.06)",
                          border: "1px solid rgba(230,57,70,0.3)",
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.12)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.06)"; }}
                      >
                        Reset detection
                      </button>
                    </div>
                  </Card>
                )}

              </div>}

            </div>
          </div>
        </div>
      </div>

      {showReset && <ResetConfirmModal onConfirm={confirmReset} onCancel={() => setShowReset(false)} />}
    </div>
  );
}
