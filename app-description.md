# Leakling — App Description (short version)

**Elevator pitch:** Leakling is an AI improvement coach for Valorant. It watches your own gameplay, detects each death, and tells you the flaw behind it — turning "I keep dying" into a single, fixable habit. Not a stat tracker.

**Description (~160 words):**
Leakling is an AI-powered improvement tool for Valorant. Instead of tracking stats, it watches your own gameplay, detects the moment behind each death, and identifies the gameplay flaw that caused it — then helps you build one focused habit to fix it.

It detects your deaths automatically by analyzing the kill feed, distinguishes your death from kills and ally fights, and tags the cause (crosshair, overpeek, no utility, bad timing, etc.) in a compact in-game overlay. Every tag builds a personal "leak profile" with a next-match focus.

Detection runs entirely on-device: window-based capture, structural kill-feed analysis that rejects map/HUD false positives, OCR nameplate confirmation, and an ONNX model that classifies the death clip into actionable flaw types with confidence.

Everything is privacy-first — no cloud, no recording, data never leaves the device. A full Mock mode demos the complete flow without a live match. Demo-ready: desktop app, website, and MSI installer available.

**Disclaimer:** The AI flaw-classification model is currently a **prototype** — not yet fully trained or production-ready. Leakling is in active development while we await responses to our Riot Games and Overwolf developer applications. The detection pipeline and demo work today, but flaw-classification quality will keep improving as the model is developed further.

*Leakling — not affiliated with Riot Games.*

