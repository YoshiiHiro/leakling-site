# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-08-06

### Added
- **Flaw taxonomy**: replaced placeholder tag causes with the full 31-subtype flaw
  taxonomy used by the detection AI (Floor-aiming, Bad pre-aim, …, Missing easy
  utility kill).
- **Video viewer capture source**: the app now detects a video player window
  (VLC, media players, `.mp4`/`.mkv` titles) as an alternate capture source, so
  the demo can analyze clips played in a viewer.
- **Sidebar FOCUS stat**: now shows the full flaw name instead of truncating to
  the first word.
- **Settings persistence**: overlay opacity, Detection AI snap on/off, and
  Auto/Manual detection mode are now saved to and restored from localStorage;
  Detection AI state is resumed on launch.
- **15% UI scale experiment**: whole window + contents scaled from 920×555 to
  1058×639 via `scale(1.15)` as a preview of a larger layout.

### Changed
- **Desktop UI redesigned** with the new Figma "Leakling Desktop UI v3" layout:
  - Sidebar navigation (Overlay / Mock / Recent Matches) + Settings page
  - Overlay controls card with position + opacity slider
  - Recent Matches tab with win/loss match logging and history
  - Monochrome theme toggle
  - Title bar now shows the app tray icon (20×20) instead of the "Leakling" text
- **Overlay popup redesigned** with the "Leakling Popup Pill Design v2":
  - Solid dark pill with purple border, purple pulse dot, centered cause label,
    and dismiss ✕
  - Removed the visible countdown timer pill and progress bar (auto-dismiss kept)
  - Removed the ambient glow box that showed as a ghost box at 100% opacity
- Window resized **1000×736 → 920×555** and made fixed (non-resizable).
- Overlay window resized **240×56 → 320×80**.
- Overlay opacity now behaves correctly: **100% = fully opaque**, lower values
  are progressively see-through.
- Detection AI no longer forces 60fps unconditionally — it runs at 60fps only
  when a Valorant/video window is detected, otherwise idles at 1fps.
- Added `lucide-react` and `tw-animate-css` dependencies.

### Fixed
- **Death detection side-awareness**: yellow edge on the killer side is now
  recognized as your kill (`my_kill`), while only the victim-side yellow edge is
  reported as a death — kills no longer trigger a death overlay.
- Ignored unrelated yellow HUD elements that were being mistaken for a death edge.
- **Watch round arming**: the round watcher waits for the kill feed to clear
  before arming, preventing a lingering death entry from re-triggering; includes
  a force-arm fallback after 5s. The watch also ends immediately on the first
  confirmed death frame.
- **False "Valorant detected"**: window matching now requires the exact title
  `VALORANT`; a video file named `Valorant_….mp4` no longer matches the game.
- **Detection AI lag**: fixed analyses overlapping and saturating the main
  thread (busy flag released too early); analyses are now serialized.
- Removed the FPS counter that forced a full app re-render every 500ms.
- Removed the overlay ghost box (`#glow` element).
- Settings persistence was missing for opacity, snap on/off, and detection mode;
  now added.

### Removed
- FPS counter from the Detection AI card.
- Ambient glow element behind the overlay popup.

---

## [0.1.1] - 2026-08-02

### Fixed
- **Packaged "Load model" crash**: native onnxruntime-node can't read paths inside
  `app.asar` — fixed via `asarUnpack` for `models/leakling/**/*` and resolving the
  model directory to `process.resourcesPath/app.asar.unpacked` when packaged.
- **Packaged launch crash**: `model-service.js` was missing from the build whitelist,
  causing a "Cannot find module './model-service.js'" error at launch.

### Added
- Model bundled into the installer with the ONNX model unpacked for native access.

---

## [0.1.0] - 2026-08-01

### Added
- Initial release of Leakling — a Valorant AI improvement tool.
- Desktop app (Electron + React) with overlay, mock, and detection AI tabs.
- Overlay popup showing the cause of death after a death event.
- Flaw Model Demo: load model → capture reference clip → analyze a live clip.
- Detection AI: screen capture, kill-feed color analysis, auto-tag + overlay trigger.
- Landing page with demo/waitlist signup.
