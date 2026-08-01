import { useState, useRef, useEffect, type CSSProperties } from "react";
import svgPaths from "../imports/LeaklingNeumorphism/svg-928pdd1may";
import appIcon from "../../gAsset 3.png";
import {
  eventBus,
  autopsyStore,
  settingsService,
  simulateDeath,
  simulateTag,
  endMockMatch,
  clearAllData,
  getAllEntries,
  getCauseCounts,
  DEATH_CAUSES,
  DEV_MODE,
  LABELS,
  deathDetector,
} from "../controller";
import type { DetectionResult } from "../death-detector";
import DemoPanel from "./components/DemoPanel";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "overlay" | "mock";
type StatusEntry = { icon: "skull" | "tag" | "stop"; message: string; highlight: string; suffix: string };
type TagEntry = { label: string; meta: string };



// ─── SVG Icons ────────────────────────────────────────────────────────────────

function SkullIcon({ color = "white" }: { color?: string }) {
  return (
    <svg className="block size-full" fill="none" height="14" viewBox="0 0 14 14" width="14">
      <path d={svgPaths.p2869a500} stroke={color} strokeLinecap="round" strokeWidth="2" />
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

// ─── Detector Icons ───────────────────────────────────────────────────────────
function ScanIcon() { return (<svg className="block size-full" fill="none" height="14" viewBox="0 0 14 14" width="14"><circle cx="7" cy="7" r="5" stroke="#9D4EDD" strokeWidth="1.5" /><path d="M7 4v3l2 1.5" stroke="#9D4EDD" strokeLinecap="round" strokeWidth="1.5" /></svg>); }
function EyeIcon() { return (<svg className="block size-full" fill="none" height="14" viewBox="0 0 14 14" width="14"><path d="M1 7s2.5-4.5 6-4.5S13 7 13 7s-2.5 4.5-6 4.5S1 7 1 7z" stroke="#8E8E93" strokeWidth="1.5" /><circle cx="7" cy="7" r="2" stroke="#8E8E93" strokeWidth="1.5" /></svg>); }
function WarningIcon() { return (<svg className="block size-full" fill="none" height="14" viewBox="0 0 14 14" width="14"><path d="M7 1.5L1 12.5h12L7 1.5z" stroke="#FF9F1C" strokeWidth="1.5" /><path d="M7 5.5v3" stroke="#FF9F1C" strokeLinecap="round" strokeWidth="1.5" /><circle cx="7" cy="10.5" r="0.6" fill="#FF9F1C" /></svg>); }
function CheckCircleIcon() { return (<svg className="block size-full" fill="none" height="14" viewBox="0 0 14 14" width="14"><circle cx="7" cy="7" r="5.5" stroke="#7FD962" strokeWidth="1.5" /><path d="M4.5 7l2 2 3-3.5" stroke="#7FD962" strokeLinecap="round" strokeWidth="1.5" /></svg>); }
function ErrorIcon() { return (<svg className="block size-full" fill="none" height="14" viewBox="0 0 14 14" width="14"><circle cx="7" cy="7" r="5.5" stroke="#FF4D6D" strokeWidth="1.5" /><path d="M5 5l4 4M9 5l-4 4" stroke="#FF4D6D" strokeLinecap="round" strokeWidth="1.5" /></svg>); }

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
  icon: React.ReactNode;
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
      <span className="relative shrink-0 size-[14px]">{icon}</span>
      <span
        className="relative text-[13px] whitespace-nowrap"
        style={{ fontFamily: "Geist, sans-serif", fontWeight: 600, color: base.text }}
      >
        {label}
      </span>
    </button>
  );
}

// ─── Overlay Controls

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

function CauseBreakdown() {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    function refresh() { setCounts({ ...getCauseCounts() }); }
    refresh();
    eventBus.on('autopsy-saved', refresh);
    return () => eventBus.off('autopsy-saved', refresh);
  }, []);

  const entries = Object.entries(counts);
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 w-full">
        <p className="text-[14px] text-center text-[#545458]" style={{ fontFamily: "Geist, sans-serif", fontWeight: 400 }}>
          Die, review, find your leak
        </p>
      </div>
    );
  }

  const sorted = entries.sort((a, b) => b[1] - a[1]);
  const max = sorted[0]?.[1] || 1;

  return (
    <div className="flex flex-col gap-[8px] w-full mt-[4px]">
      {sorted.map(([label, count]) => (
        <div key={label} className="flex items-center gap-[10px]">
          <span className="text-[11px] text-[#8e8e93] w-[110px] shrink-0 truncate" style={{ fontFamily: "Geist, sans-serif", fontWeight: 500 }}>
            {LABELS[label as keyof typeof LABELS] || label}
          </span>
          <div className="flex-1 h-[6px] rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(count / max) * 100}%`, background: "linear-gradient(90deg, #7b2cbf, #9d4edd)", boxShadow: "0 0 6px rgba(157,78,221,0.4)" }} />
          </div>
          <span className="text-[11px] text-[#545458] w-[16px] text-right shrink-0" style={{ fontFamily: "Geist Mono, monospace", fontWeight: 400 }}>{count}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Recent Tags ──────────────────────────────────────────────────────────────

function RecentTags() {
  const [tags, setTags] = useState<any[]>([]);
  useEffect(() => {
    function refresh() { setTags([...getAllEntries()]); }
    refresh();
    eventBus.on('autopsy-saved', refresh);
    return () => eventBus.off('autopsy-saved', refresh);
  }, []);
  if (tags.length === 0) return <p className="text-[13px] text-[#545458]" style={{ fontFamily: "Geist, sans-serif" }}>No tags yet</p>;
  const fmt = (ts: number) => { try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); } catch { return '—'; } };
  return (
    <div className="flex flex-col gap-[6px] w-full">
      {[...tags].reverse().slice(0, 20).map((t: any, i: number) => (
        <div key={t.id || i} className="relative rounded-[10px] w-full" style={{ background: "#0b0b0d" }}>
          <div className="flex items-center justify-between px-[12px] py-[10px]">
            <span className="text-[13px]" style={{ fontFamily: "Geist, sans-serif", fontWeight: 600, color: t.skipped ? "#545458" : "#8e8e93", fontStyle: t.skipped ? "italic" : "normal" }}>
              {t.skipped ? "Skipped" : LABELS[t.cause as keyof typeof LABELS] || t.cause || "—"}
            </span>
            <span className="text-[12px] text-[#545458]" style={{ fontFamily: "Geist Mono, monospace", fontWeight: 400 }}>
              {t.score || (t.round != null ? `R${t.round}` : "")}{fmt(t.timestamp) ? ` · ${fmt(t.timestamp)}` : ""}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Overlay Controls ─────────────────────────────────────────────────────────

const POSITION_OPTIONS = ["Top left", "Top right", "Bottom left", "Bottom right"];

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

// ─── Hotkey Badge ──────────────────────────────────────────────────

const MODIFIERS = ['Control', 'Alt', 'Meta', 'Shift'];
const MOD_MAP: Record<string, string> = { Control: 'Ctrl', Alt: 'Alt', Meta: 'Cmd', Shift: 'Shift' };

function HotkeyBadge({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [listening, setListening] = useState(false);
  const heldRef = useRef<Set<string>>(new Set());
  const comboRef = useRef<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!listening) return;

    heldRef.current.clear();
    comboRef.current = [];

    const modName = (k: string) => ({ Control: 'Ctrl', Alt: 'Alt', Meta: 'Cmd', Shift: 'Shift' })[k] || k;

    const onDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      heldRef.current.add(e.key);
      const isMod = ['Control', 'Alt', 'Meta', 'Shift'].includes(e.key);
      const n = isMod ? modName(e.key) : (e.key.length === 1 ? e.key.toUpperCase() : e.key);
      if (!comboRef.current.includes(n)) comboRef.current.push(n);
    };

    const onUp = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') { setListening(false); return; }
      heldRef.current.delete(e.key);
      // Register only when ALL keys are released and we have a combo
      if (heldRef.current.size === 0 && comboRef.current.length > 0) {
        // Separate modifiers from main key
        const mods = comboRef.current.filter(k => ['Ctrl', 'Alt', 'Cmd', 'Shift'].includes(k));
        const main = comboRef.current.filter(k => !['Ctrl', 'Alt', 'Cmd', 'Shift'].includes(k));
        const result = main.length > 0 ? [...mods, main[0]].join('+') : mods.join('+');
        if (result) { onChange(result); setListening(false); }
      }
    };

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, [listening, onChange]);

  // Click outside cancels
  useEffect(() => {
    if (!listening) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setListening(false);
    };
    setTimeout(() => window.addEventListener('mousedown', handler), 0);
    return () => window.removeEventListener('mousedown', handler);
  }, [listening]);

  return (
    <div
      ref={ref}
      onClick={() => setListening(true)}
      className="px-[8px] py-[4px] rounded-[6px] text-[11px] cursor-pointer select-none outline-none transition-all duration-150"
      style={{
        fontFamily: "Geist Mono, monospace",
        fontWeight: listening ? 700 : 500,
        color: listening ? "#9d4edd" : "#545458",
        background: listening ? "rgba(157,78,221,0.12)" : "#0b0b0d",
        border: `1px solid ${listening ? "#9d4edd" : "rgba(255,255,255,0.07)"}`,
        boxShadow: listening ? "0 0 6px rgba(157,78,221,0.3)" : "none",
        whiteSpace: "nowrap",
        minWidth: 60,
        textAlign: "center",
      }}
    >
      {listening ? "Press keys..." : value}
    </div>
  );
}

function OverlayControlsCard({
  overlayOn, onToggleOverlay,
  position, onPosition,
  onTagDeath, onClearSession,
  overlayStatus,
  tagHotkey, onTagHotkey,
  toggleHotkey, onToggleHotkey,
}: {
  overlayOn: boolean;
  onToggleOverlay: () => void;
  position: string;
  onPosition: (v: string) => void;
  onTagDeath: () => void;
  onClearSession: () => void;
  overlayStatus: StatusEntry | null;
  tagHotkey?: string;
  onTagHotkey?: (v: string) => void;
  toggleHotkey?: string;
  onToggleHotkey?: (v: string) => void;
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

        {/* Position */}
        <div className="flex flex-col gap-[8px] w-full">
          <p className="text-[10px] text-[#545458] tracking-[0.8px]" style={{ fontFamily: "Geist Mono, monospace", fontWeight: 600 }}>
            POSITION
          </p>
          <div className="flex gap-[6px]">
            {POSITION_OPTIONS.map((opt) => (
              <PositionBtn key={opt} label={opt} active={position === opt} onClick={() => onPosition(opt)} />
            ))}
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
            <HotkeyBadge value={tagHotkey || "Ctrl+Shift+D"} onChange={onTagHotkey || (() => {})} />
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
            <HotkeyBadge value={toggleHotkey || "Ctrl+Shift+A"} onChange={onToggleHotkey || (() => {})} />
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

// ─── Detector Panel ───────────────────────────────────────────────────────────

function stateColor(state: string) {
  switch (state) {
    case 'death_confirmed': return '#7FD962';
    case 'my_kill': return '#FF4D6D';
    case 'scanning': return '#9D4EDD';
    case 'spectate_rejected': return '#FF9F1C';
    case 'low_confidence': return '#FF9F1C';
    case 'error': return '#FF4D6D';
    default: return '#545458';
  }
}
function stateIcon(state: string, size = 14) {
  const s = { width: size, height: size };
  switch (state) {
    case 'death_confirmed': return <span style={s}><CheckCircleIcon /></span>;
    case 'my_kill': return <span style={s}><SkullIcon color="#FF4D6D" /></span>;
    case 'scanning': return <span style={s}><ScanIcon /></span>;
    case 'spectate_rejected': return <span style={s}><EyeIcon /></span>;
    case 'low_confidence': return <span style={s}><WarningIcon /></span>;
    case 'error': return <span style={s}><ErrorIcon /></span>;
    default: return <span style={s}><EyeIcon /></span>;
  }
}
function DetectorPanel({ overlayPosition = 'Top right', overlayOn = true }: { overlayPosition?: string; overlayOn?: boolean }) {
  const [lastResult, setLastResult] = useState<DetectionResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isSnapping, setIsSnapping] = useState(false);
  const [autoSnap, setAutoSnap] = useState(() => settingsService.get('autoSnap') ?? false);
  const [capStats, setCapStats] = useState({ captured: 0, dropped: 0, fps: 0 });
  useEffect(() => { const iv = setInterval(() => { setCapStats(deathDetector.captureStats); }, 500); return () => clearInterval(iv); }, []);

  // Live-update UI on every snap analysis + trigger overlay on death
  useEffect(() => {
    deathDetector.setPlayerName((settingsService.get("playerName") as string) || "");
    deathDetector.onResult((result) => {
      setLastResult(result);
    });
    deathDetector.onAutoDetect((result) => {
      // Only react to confirmed deaths
      if (result.state !== 'death_confirmed' || result.confidence < 0.3) return;

      const cause = 'crosshair_placement';
      const detectedScore = result.score;
      autopsyStore.save({
        matchId: 'snap-detect',
        round: detectedScore || Math.floor(Date.now() / 1000) % 100,
        score: detectedScore,
        side: 'auto',
        cause,
        timestamp: Date.now(),
        skipped: false,
      });
      eventBus.trigger('autopsy-saved', {});

      // Show overlay
      if (window.electronAPI?.showOverlay && overlayOn) {
        const pos = overlayPosition.toLowerCase().replace(' ', '_');
        window.electronAPI.sendDeathEvent({
          matchId: 'snap-detect', round: detectedScore || 1, side: 'detected',
          deaths: 1, source: 'snapshot', timestamp: Date.now(),
          cause,
        });
        window.electronAPI.showOverlay({ position: pos, opacity: 75 });
      }
    });
    return () => { deathDetector.onResult(() => {}); deathDetector.onAutoDetect(() => {}); };
  }, [overlayPosition, overlayOn]);

  async function toggleSnap() {
    if (isSnapping) {
      deathDetector.stopSnapping();
      setIsSnapping(false);
    } else {
      // Auto-detect which screen has Valorant
      await deathDetector.detectValorantScreen();
      deathDetector.startSnapping(true); // force high perf for manual snap
      setIsSnapping(true);
    }
  }
  function resetDetector() { deathDetector.reset(); setLastResult(null); setIsScanning(false); }
  const currentState = lastResult?.state || 'idle';
  const color = stateColor(currentState);
  const conf = lastResult?.confidence ?? 0;
  return (
    <div className="relative rounded-[16px] w-full shrink-0" style={{ background: "#16161a", border: "1px solid rgba(255,255,255,0.05)", boxShadow: "4px 4px 8px rgba(0,0,0,0.31), -4px -4px 8px rgba(255,255,255,0.03)" }}>
      <div className="flex flex-col gap-[10px] items-start p-[16px]">
        <div className="flex items-center justify-between w-full">
          <div className="flex gap-[8px] items-center">
            <p className="text-[11px] text-[#8e8e93]" style={{ fontFamily: "Geist Mono, monospace", fontWeight: 700 }}>DETECTION AI</p>
            {lastResult && <span className="inline-flex items-center gap-[4px] px-[6px] py-[2px] rounded-full text-[9px]" style={{ background: `${color}18`, color, border: `1px solid ${color}40`, fontFamily: "Geist Mono, monospace" }}>{stateIcon(currentState, 10)}{currentState.replace('_', ' ')}</span>}
            {isSnapping && <span className="text-[9px] text-[#9d4edd]" style={{ fontFamily: "Geist Mono, monospace" }}>{capStats.fps > 0 ? `${capStats.fps} fps` : '...'}</span>}
          </div>
          <button onClick={toggleSnap} className="text-[10px] px-[10px] py-[4px] rounded-full transition-all duration-150 focus:outline-none" style={{ background: isSnapping ? "rgba(157,78,221,0.15)" : "rgba(255,255,255,0.04)", border: `1px solid ${isSnapping ? "#9d4edd" : "rgba(255,255,255,0.07)"}`, color: isSnapping ? "#9d4edd" : "#8e8e93", fontFamily: "Geist, sans-serif", fontWeight: 600 }}>{isSnapping ? `● Snap` : '○ Snap off'}</button>
        </div>
        {lastResult && <div className="flex items-center gap-[8px] w-full"><div className="flex-1 h-[4px] rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}><div className="h-full rounded-full transition-all duration-300" style={{ width: `${conf * 100}%`, background: `linear-gradient(90deg, #7b2cbf, ${color})`, boxShadow: `0 0 6px ${color}60` }} /></div><span className="text-[10px] shrink-0" style={{ fontFamily: "Geist Mono, monospace", color, fontWeight: 600 }}>{Math.round(conf * 100)}%</span></div>}
        {lastResult?.entries && lastResult.entries.length > 0 && <div className="flex flex-col gap-[4px] w-full">{lastResult.entries.map((entry, i) => (<div key={i} className="flex items-center h-[22px] rounded-[4px] overflow-hidden text-[10px] font-semibold" style={{ fontFamily: "Geist, sans-serif" }}><div className="flex items-center justify-center h-full px-[8px] min-w-[60px]" style={{ background: "rgba(255,70,85,0.35)", color: "#ff4655" }}>{entry.killerName}</div><div className="flex items-center justify-center h-full w-[18px] shrink-0" style={{ background: "rgba(255,255,255,0.04)" }}><svg width="10" height="10" viewBox="0 0 14 14" fill="none"><path d="M2 12L7 3l5 9" stroke="#8E8E93" strokeWidth="1.5" strokeLinecap="round" /><circle cx="7" cy="3" r="1.5" stroke="#8E8E93" strokeWidth="1.5" /></svg></div><div className="flex items-center justify-center h-full px-[8px] min-w-[60px] flex-1 relative" style={{ background: "rgba(127,217,98,0.2)", color: "#7fd962" }}>{entry.victimName}{entry.hasYellowEdge && <div className="absolute right-0 top-0 h-full w-[3px] rounded-r-[2px]" style={{ background: "#FFD700", boxShadow: "0 0 6px rgba(255,215,0,0.7)" }} />}</div></div>))}</div>}
        {lastResult && <p className="text-[11px] leading-[1.4] w-full" style={{ fontFamily: "Geist Mono, monospace", color: "#c4c4c6", fontWeight: 400 }}>{deathDetector.recommendation}</p>}
        {lastResult?.error && <div className="w-full rounded-[8px] p-[8px] text-[11px]" style={{ background: "rgba(255,77,109,0.1)", border: "1px solid rgba(255,77,109,0.25)", color: "#ff4d6d", fontFamily: "Geist Mono, monospace" }}>⚠ {lastResult.error}</div>}
        {lastResult?.spectateWarning && <div className="w-full rounded-[8px] p-[8px] text-[11px]" style={{ background: "rgba(255,159,28,0.1)", border: "1px solid rgba(255,159,28,0.25)", color: "#ff9f1c", fontFamily: "Geist Mono, monospace" }}>👁 {lastResult.spectateWarning}</div>}
        <div className="flex items-center gap-[8px] w-full">
          <button onClick={() => { const next = !autoSnap; setAutoSnap(next); settingsService.set('autoSnap', next); if (next) deathDetector.startWatching(); else deathDetector.stopWatching(); }} className="text-[10px] px-[8px] py-[4px] rounded-full transition-all duration-150 focus:outline-none" style={{ background: autoSnap ? "rgba(157,78,221,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${autoSnap ? "rgba(157,78,221,0.35)" : "rgba(255,255,255,0.07)"}`, color: autoSnap ? "#9d4edd" : "#8e8e93", fontFamily: "Geist, sans-serif", fontWeight: 600 }}>Auto</button>
          <button onClick={resetDetector} className="text-[11px] px-[10px] py-[5px] rounded-[8px] transition-all duration-150 focus:outline-none ml-auto" style={{ background: "rgba(255,77,109,0.08)", border: "1px solid rgba(255,77,109,0.2)", color: "#ff4d6d", fontFamily: "Geist, sans-serif", fontWeight: 600 }}>Reset</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("mock");

  // Mock state
  const [mockOn, setMockOn] = useState(false);
  const [status, setStatus] = useState<StatusEntry | null>(null);
  const [showReset, setShowReset] = useState(false);

  // Overlay state — initialize from saved settings
  const _saved = settingsService.getAll();
  const [overlayOn, setOverlayOn] = useState(_saved.overlayOn);
  const [overlayPosition, setOverlayPosition] = useState(_saved.overlayPosition);

  const [overlayStatus, setOverlayStatus] = useState<StatusEntry | null>(null);
  const [toggleHotkey, setToggleHotkey] = useState(_saved.toggleHotkey);
  const [tagHotkey, setTagHotkey] = useState(_saved.tagHotkey);

  // Shared state
  const [focus, setFocus] = useState("— clear —");
  const [matchActive, setMatchActive] = useState(false);

  const tagsScrollRef = useRef<HTMLDivElement>(null);
  const breakdownScrollRef = useRef<HTMLDivElement>(null);

  // ── Apply saved settings + focus on mount ────────────────────
  useEffect(() => {
    window.MOCK_MODE = _saved.mockOn;
    setMockOn(_saved.mockOn);
    refreshFocusFromCounts();
    // Position the overlay window at the saved position immediately
    window.electronAPI?.setOverlayPosition?.(_saved.overlayPosition.toLowerCase().replace(' ', '_'));
    window.electronAPI?.setOverlayOpacity?.(75);

    // When Valorant opens → minimize to tray; when closes → restore
    deathDetector.onValorantState((isOpen) => {
      if (isOpen) {
        window.electronAPI?.hideToTray?.();
      } else {
        window.electronAPI?.showFromTray?.();
      }
    });

    return () => {
      deathDetector.stopWatching();
    };
  }, []);

  // ── Refresh focus whenever a new tag is saved ────────────────
  useEffect(() => {
    function onSaved() { refreshFocusFromCounts(); }
    eventBus.on('autopsy-saved', onSaved);
    return () => eventBus.off('autopsy-saved', onSaved);
  }, []);

  function refreshFocusFromCounts() {
    const counts = getCauseCounts();
    const entries = Object.entries(counts) as Array<[string, number]>;
    if (entries.length === 0) {
      setFocus('— clear —');
      return;
    }
    // Find the max count
    const maxCount = Math.max(...entries.map(([, c]) => c));
    // Get all causes tied at the max
    const topCauses = entries
      .filter(([, c]) => c === maxCount)
      .map(([id]) => LABELS[id as keyof typeof LABELS] || id);
    setFocus(topCauses.join(' / '));
  }

  // ── Auto-save settings whenever they change ─────────────────────
  useEffect(() => {
    settingsService.setAll({
      overlayOn,
      overlayPosition,
      toggleHotkey,
      tagHotkey,
      mockOn,
    });
  }, [overlayOn, overlayPosition, toggleHotkey, tagHotkey, mockOn]);

  function handleSimulateDeath() {
    if (!mockOn) return;
    const payload = simulateDeath();
    if (!payload) return;
    setMatchActive(true);
    // Pick a random cause for the mock death
    const randomCause = DEATH_CAUSES[Math.floor(Math.random() * DEATH_CAUSES.length)];
    (payload as { cause?: string }).cause = randomCause.id;
    setStatus({ icon: "skull", message: "Death simulated —", highlight: "overlay shown", suffix: " (6s)" });
    if (window.electronAPI?.showOverlay) { window.electronAPI.sendDeathEvent(payload); window.electronAPI.showOverlay({ position: overlayPosition.toLowerCase().replace(' ', '_'), opacity: 75 }); }
  }

  function handleSimulateTag() {
    if (!mockOn) return;
    const payload = simulateDeath();
    if (!payload) return;
    setMatchActive(true);
    setTimeout(() => {
      const causes = DEATH_CAUSES as Array<{ id: string; label: string }>;
      const cause = causes[Math.floor(Math.random() * causes.length)];
      simulateTag(cause.id);
      setStatus({ icon: "tag", message: "Death tagged —", highlight: cause.label, suffix: "" });
      setTimeout(() => { if (tagsScrollRef.current) tagsScrollRef.current.scrollTop = tagsScrollRef.current.scrollHeight; }, 50);
    }, 100);
    setStatus({ icon: "skull", message: "Death simulated —", highlight: "auto-tagging...", suffix: "" });
  }

  function handleEndMatch() {
    const summary = endMockMatch();
    if (summary) {
      setMatchActive(false);
      setStatus({ icon: "stop", message: "Mock match ended —", highlight: `${summary.taggedCount} tags recorded`, suffix: "" });
      refreshFocusFromCounts();
    }
  }

  function handleReset() { setShowReset(true); }

  function confirmReset() {
    clearAllData();
    eventBus.trigger('autopsy-saved', {});
    setStatus(null); setMatchActive(false); setFocus("— clear —"); setShowReset(false);
  }

  function handleOverlayTagDeath() {
    if (!overlayOn) return;
    const causes = DEATH_CAUSES as Array<{ id: string; label: string }>;
    const cause = causes[Math.floor(Math.random() * causes.length)];
    simulateTag(cause.id);
    setOverlayStatus({ icon: "tag", message: "Death tagged —", highlight: cause.label, suffix: "" });
    setTimeout(() => { if (tagsScrollRef.current) tagsScrollRef.current.scrollTop = tagsScrollRef.current.scrollHeight; }, 50);
  }

  function handleOverlayClearSession() {
    clearAllData();
    eventBus.trigger('autopsy-saved', {});
    setOverlayStatus({ icon: "stop", message: "Session cleared —", highlight: "all tags removed", suffix: "" });
  }

  function handleOverlayToggle() {
    setOverlayOn((v: boolean) => {
      const next = !v;
      setOverlayStatus(next
        ? { icon: "skull", message: "Overlay enabled —", highlight: overlayPosition.toLowerCase(), suffix: ` · 75%` }
        : { icon: "stop", message: "Overlay hidden —", highlight: `press ${toggleHotkey} to restore`, suffix: "" }
      );
      return next;
    });
  }

  const contentRef = useRef<HTMLDivElement>(null);

  // ── Auto-resize window to fit content ─────────────────────────
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout>;
    const observer = new ResizeObserver((entries) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const h = entries[0]?.contentRect?.height;
        if (h && window.electronAPI?.resizeToContent) {
          window.electronAPI.resizeToContent(Math.ceil(h));
        }
      }, 150);
    });
    observer.observe(el);
    return () => { observer.disconnect(); clearTimeout(timer); };
  }, []);

  const focusLabel = focus === "— clear —" ? "No focus set" : focus;

  return (
    <div
      ref={contentRef}
      className="flex justify-center items-start"
      style={{ background: "#080809", padding: "0" }}
    >
      <div
        style={{
          width: 1000,
          minWidth: 1000,
          maxWidth: 1000,
          minHeight: 700,
          background: "#0f0f12",
          overflowX: "hidden",
          position: "relative",
        }}
      >
      {/* Custom title bar */}
      <div
        className="flex items-center justify-between w-full shrink-0"
        style={{
          height: 36,
          background: "#0b0b0d",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          WebkitAppRegion: "drag",
          userSelect: "none",
          padding: "0 8px 0 14px",
        } as CSSProperties}
      >
        <div className="flex items-center gap-[8px]">
          <img src={appIcon} alt="" style={{ width: 18, height: 18, borderRadius: 4 }} />
          <span className="text-[13px] text-white" style={{ fontFamily: "Geist, sans-serif", fontWeight: 600, letterSpacing: "-0.1px" }}>Leakling</span>
        </div>
        <div className="flex items-center gap-[4px]" style={{ WebkitAppRegion: "no-drag" } as CSSProperties}>
          <button
            onClick={() => window.electronAPI?.minimizeWindow?.()}
            className="flex items-center justify-center w-[30px] h-[26px] rounded-[6px] transition-all duration-100"
            style={{ color: "#8e8e93", background: "transparent", border: "none", cursor: "pointer", fontSize: 12 }}
            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >─</button>
          <button
            onClick={() => window.electronAPI?.closeWindow?.()}
            className="flex items-center justify-center w-[30px] h-[26px] rounded-[6px] transition-all duration-100"
            style={{ color: "#8e8e93", background: "transparent", border: "none", cursor: "pointer", fontSize: 12 }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,77,109,0.15)"; e.currentTarget.style.color = "#ff4d6d"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#8e8e93"; }}
          >✕</button>
        </div>
      </div>
      <div className="flex flex-col gap-[12px] items-start p-[20px] w-full">
        {/* Header */}
        <div className="flex items-center justify-between w-full shrink-0">
          <div className="flex flex-col gap-[2px]">
            <p className="text-[16px] text-white tracking-[-0.18px]" style={{ fontFamily: "Geist, sans-serif", fontWeight: 700 }}>
              Leakling
            </p>
            <p className="text-[9px] text-[#8e8e93] tracking-[1px]" style={{ fontFamily: "Geist Mono, monospace", fontWeight: 600 }}>
              DESKTOP
            </p>
          </div>
        </div>

        {/* Tagline */}
        <div className="flex flex-col gap-[6px] w-full shrink-0">
          <p
            className="text-[24px] text-white tracking-[-0.4px] leading-tight"
            style={{ fontFamily: "Geist, sans-serif", fontWeight: 800 }}
          >
            Tag why you died. Find your leak.
          </p>
          <p
            className="text-[13px] text-[#8e8e93] leading-[1.4]"
            style={{ fontFamily: "Geist, sans-serif", fontWeight: 400 }}
          >
            Review your death-cause habits between queues. Set one specific focus to reduce tactical mistakes in your next match.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-[10px] items-center w-full shrink-0">
          <Tab label="Overlay" sub={toggleHotkey} active={activeTab === "overlay"} onClick={() => setActiveTab("overlay")} />
          {DEV_MODE && <Tab label="Mock" sub="" active={activeTab === "mock"} onClick={() => setActiveTab("mock")} />}
        </div>

        {/* Tab-specific top card */}
        {activeTab === "overlay" ? (
          <OverlayControlsCard
            overlayOn={overlayOn}
            onToggleOverlay={handleOverlayToggle}
            position={overlayPosition}
            onPosition={(v) => { setOverlayPosition(v); window.electronAPI?.setOverlayPosition?.(v); }}

            onTagDeath={handleOverlayTagDeath}
            onClearSession={handleOverlayClearSession}
            overlayStatus={overlayStatus}
            tagHotkey={tagHotkey}
            onTagHotkey={(v) => { setTagHotkey(v); window.electronAPI?.updateHotkeys?.({ toggle: toggleHotkey, manualTag: v }); }}
            toggleHotkey={toggleHotkey}
            onToggleHotkey={(v) => { setToggleHotkey(v); window.electronAPI?.updateHotkeys?.({ toggle: v, manualTag: tagHotkey }); }}
          />
        ) : DEV_MODE ? (
          <div
            className="relative rounded-[16px] w-full shrink-0"
            style={{
              background: "#16161a",
              border: "1px solid rgba(255,255,255,0.05)",
              boxShadow: "4px 4px 8px rgba(0,0,0,0.31), -4px -4px 8px rgba(255,255,255,0.03)",
            }}
          >
            <div className="flex flex-col gap-[12px] items-start p-[16px]">
              <div className="flex items-center justify-between w-full">
                <p className="text-[11px] text-[#8e8e93]" style={{ fontFamily: "Geist Mono, monospace", fontWeight: 700 }}>
                  MOCK CONTROLS
                </p>
                <div className="flex gap-[10px] items-center">
                  <p className="text-[12px] text-[#8e8e93] whitespace-nowrap" style={{ fontFamily: "Geist, sans-serif", fontWeight: 400 }}>
                    Mock mode
                  </p>
                  <Switch on={mockOn} onToggle={() => { setMockOn((v) => { const n = !v; window.MOCK_MODE = n; return n; }); }} />
                </div>
              </div>
              <div className="flex flex-wrap gap-[8px] items-center w-full">
                <ActionBtn icon={<SkullIcon color={mockOn ? "white" : "#555"} />} label="Simulate death" variant="purple" onClick={handleSimulateDeath} disabled={!mockOn} />
                <ActionBtn icon={<TagIcon color={mockOn ? "#8E8E93" : "#444"} />} label="Simulate + tag" variant="neutral" onClick={handleSimulateTag} disabled={!mockOn} />
                <ActionBtn icon={<StopIcon color={matchActive ? "#8E8E93" : "#444"} />} label="End mock match" variant="neutral" onClick={handleEndMatch} disabled={!matchActive} />
                <ActionBtn icon={<TrashIcon />} label="Reset all data" variant="danger" onClick={handleReset} />
              </div>
              {status && <StatusBox entry={status} />}
            </div>
          </div>
        ) : null}

        {/* Detection AI Detector */}
        <DetectorPanel
          overlayPosition={overlayPosition}
          overlayOn={overlayOn}
        />

        {/* Flaw Model Demo */}
        <DemoPanel deathDetector={deathDetector} />

        {/* Focus Card */}
        <div
          className="relative rounded-[16px] w-full shrink-0"
          style={{
            background: "#16161a",
            border: "1px solid rgba(255,255,255,0.05)",
            boxShadow: "4px 4px 8px rgba(0,0,0,0.31), -4px -4px 8px rgba(255,255,255,0.03)",
          }}
        >
          <div className="flex flex-col gap-[10px] items-start p-[16px]">
            <p className="text-[11px] text-[#8e8e93] w-full" style={{ fontFamily: "Geist Mono, monospace", fontWeight: 700 }}>
              NEXT-MATCH FOCUS
            </p>
            <div className="flex items-center w-full">
              <p className="text-[18px] text-white" style={{ fontFamily: "Geist, sans-serif", fontWeight: 700 }}>
                {focusLabel}
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="flex gap-[12px] w-full" style={{ height: 160 }}>
          {/* Cause Breakdown */}
          <div
            className="flex-1 relative rounded-[16px] min-w-0"
            style={{
              background: "#16161a",
              border: "1px solid rgba(255,255,255,0.05)",
              boxShadow: "4px 4px 8px rgba(0,0,0,0.31), -4px -4px 8px rgba(255,255,255,0.03)",
            }}
          >
            <div className="flex flex-col gap-[12px] items-start p-[16px] h-full overflow-hidden">
              <p className="text-[11px] text-[#8e8e93] w-full shrink-0" style={{ fontFamily: "Geist Mono, monospace", fontWeight: 700 }}>
                CAUSE BREAKDOWN
              </p>
              <div
                ref={breakdownScrollRef}
                className="flex-1 w-full overflow-y-auto"
                style={{ scrollbarWidth: "none" }}
              >
                <CauseBreakdown />
              </div>
            </div>
          </div>

          {/* Recent Tags */}
          <div
            className="flex-1 relative rounded-[16px] min-w-0 overflow-hidden"
            style={{
              background: "#16161a",
              border: "1px solid rgba(255,255,255,0.05)",
              boxShadow: "4px 4px 8px rgba(0,0,0,0.31), -4px -4px 8px rgba(255,255,255,0.03)",
            }}
          >
            <div className="flex flex-col gap-[12px] items-start p-[16px] h-full overflow-hidden">
              <p className="text-[11px] text-[#8e8e93] w-full shrink-0" style={{ fontFamily: "Geist Mono, monospace", fontWeight: 700 }}>
                RECENT TAGS
              </p>
              <div
                ref={tagsScrollRef}
                className="flex-1 w-full overflow-y-auto"
                style={{ scrollbarWidth: "none" }}
              >
                <RecentTags />
              </div>
            </div>
          </div>
        </div>
      </div>

      {showReset && (
        <ResetConfirmModal onConfirm={confirmReset} onCancel={() => setShowReset(false)} />
      )}
      </div>
    </div>
  );
}
