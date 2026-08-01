# Leakling

A Valorant death-reason overlay. Tag why you died and build a personal leak profile.

Built with **Electron + React + Vite + Tailwind CSS**. Desktop UI designed in Figma.

<div align="center">
  <img src="https://img.shields.io/badge/Leakling-0.1.0-a78bfa?style=for-the-badge" alt="Leakling 0.1.0" />
  <img src="https://img.shields.io/badge/Valorant-AI%20Improvement%20Tool-7c3aed?style=for-the-badge" alt="Valorant AI Improvement Tool" />
  <img src="https://img.shields.io/badge/demo-ready-7fd962?style=for-the-badge" alt="Demo ready" />
</div>

## 🚀 Demo walkthrough (for reviewers)

A ~10-minute review path — **no live Valorant match required**.

1. **📦 Install & launch**
   Run the desktop app (`npm start`) or the portable EXE / MSI installer. The desktop window opens automatically.

2. **🎭 Mock mode** — the full flow without a game
   - Open the **Mock** tab → toggle **Mock mode** on
   - **Simulate death** → the in-game overlay appears → pick a cause
   - Watch tags fill **Cause breakdown** and **Recent tags**
   - **End mock match** → see the summary + next-match focus

3. **🧠 Flaw model demo** — see the AI classify a death
   - In the **FLAW MODEL DEMO** panel: **Load model** → **Capture reference**
   - Optional: type the POV player's name in **Your name (OCR confirm)**
   - **Watch round** while a clip plays (e.g. VLC) → on death it shows flaw type, confidence, and severity

4. **🎯 Detection AI** — live kill-feed detection
   - In the **DETECTION AI** panel: toggle **Snap** (or **Auto**)
   - Watch the state chip + FPS; a confirmed death saves a tag and opens the overlay
   - **Reset** clears detector history

> **Note:** the AI flaw-classification model is a **prototype** — the detection pipeline works today, while flaw-classification quality keeps improving as development continues (pending Riot/Overwolf developer applications).

## Quick start

### 1. Install Node.js (if not already installed)

Download from [nodejs.org](https://nodejs.org/) (v18+). Verify with:

```powershell
node --version
```

### 2. Install dependencies

```powershell
npm install
```

### 3. Run the app

```powershell
npm start
```

This builds the React frontend with Vite, then launches Electron.

### 4. Build a standalone EXE

```powershell
npm run build
```

The portable EXE will be in the `dist/` folder — no install needed.

## How to test (Mock Mode)

1. Run the app — the **desktop window** opens automatically
2. Click **💀 Simulate death** — a transparent overlay window appears
3. Click a cause button on the overlay (or wait 6s for timeout)
4. Tagged deaths appear in **Cause breakdown** and **Recent tags**
5. Click **⏹ End mock match** to generate a summary
6. Click **🗑 Reset all data** to clear everything

### Buttons

| Button | Action |
|--------|--------|
| 💀 Simulate death | Opens the overlay as if you died in-game |
| 🏷️ Simulate + tag | Same + auto-picks a random cause |
| ⏹ End mock match | Ends match, shows breakdown |
| 🗑 Reset all data | Clears all stored tags |

### Hotkeys

| Key | Action |
|-----|--------|
| `Ctrl+Shift+A` | Toggle desktop window |
| `Ctrl+Shift+D` | Simulate death (mock mode) |

## Flaw Model Demo (FLAW MODEL DEMO panel)

The bottom panel runs the ONNX flaw-classification model on screen clips to show what the AI "sees" for a death. Three steps:

1. **Load model** — loads the on-device ONNX model (onnxruntime-node). The status chip turns green and shows the number of flaw classes once ready.
2. **Capture reference** — grabs an 8-frame clip from the current capture source as the "flawless" baseline. The source is picked automatically: a live **VALORANT window** first, then a **video viewer** (e.g. VLC, for clip-based demos), then screen 1.
3. **Watch round** — continuously captures frames into a rolling buffer and watches for a death (same kill-feed detector as the Detection AI panel). When your death is confirmed, it runs the model on the clip that led up to it vs. the reference and shows:
   - the **flaw type** and readable name
   - **confidence %** with a progress bar
   - a **severity** indicator (🔴 / 🟡 / 🟢)

**Your name (OCR confirm):** enter the in-game name shown on the POV player's nameplate so the detector can OCR-confirm a gold-edge kill-feed entry is *your* death (or your kill). Leave empty to rely on the visual heuristics only.

## Detection AI (DETECTION AI panel)

Scans the game/video window's kill feed in real time to detect your deaths and kills:

- **Snap** — start/stop the live capture loop (captures the game or video window directly).
- **Auto** — watches for VALORANT to launch, then runs the capture loop at high frequency; shows a live **FPS** counter while snapping.
- The detector parses kill-feed entries (red killer / green victim blocks) and only confirms a **death** when a contiguous gold edge sits on the victim's right boundary (and **your kill** when it's on the killer side). OCR reads the nameplate to verify it's you.
- On a confirmed death it saves a death tag and shows the in-game overlay.
- The state chip shows what the detector sees: `idle`, `scanning`, `death_confirmed`, `my_kill`, `low_confidence`, etc.
- **Reset** clears the detector's history.

## Cause breakdown & recent tags

- **Cause breakdown** — a live bar chart of your tagged death causes (crosshair, overpeek, no utility, bad timing, poor trade, other). It updates the moment a tag is saved, and the **Next-match focus** is auto-calculated from your most-tagged cause.
- **Recent tags** — the last 20 death entries with their cause and timestamp. Uses a 5-second dedup window and a 3-second death cooldown to avoid double-counting, with a 500-entry cap.

## Project structure

```
Leakling/
├── main.js              # Electron main process
├── preload.js           # IPC bridge
├── src/                 # React app (Vite)
│   ├── main.tsx         # Entry point
│   ├── App.tsx          # Main UI (Figma design)
│   ├── controller.ts    # Backend logic (EventBus, AutopsyStore)
│   ├── styles/          # CSS (Tailwind + theme)
│   └── imports/         # Figma export components
├── scripts/services/    # Core services (shared with Overwolf build)
├── windows/in-game/     # Overlay window (plain HTML/JS)
├── icons/               # App icons
└── manifest.json        # Overwolf manifest (for future port)

## Porting to Overwolf

When you get Overwolf dev client access:
1. Switch `main.js` to load `windows/desktop/desktop.html` instead of `dist/index.html`
2. Set `MOCK_MODE = false` in `scripts/constants.js`
3. Set `"in_game_only": true` in `manifest.json`
4. Submit to Overwolf for production whitelisting
