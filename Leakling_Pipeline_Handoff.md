# Leakling — Pipeline Structure & Handoff Document

> **Purpose:** This document lets any new coding session (or the separate Leakling project session) understand the complete pipeline structure, current state, and how to run each step — without re-exploring the whole project.
>
> **Last updated:** 2026-08-01

---

## 1. Project Overview

**Leakling** is an AI that detects Valorant gameplay flaws by comparing **flawed vs flawless** clips of the same situation. It is an **improvement tool, NOT a stat tracker** (no KD/ACS/HS%).

**Key constraint for Riot demo:** Do not use pro player footage (LEV Sato etc.) as examples — use the user's own gameplay only.

---

## 2. Tech Stack

| Component | Choice |
|-----------|--------|
| **Language** | Python 3.14 (at `C:/Users/notiv/AppData/Local/Programs/Python/Python314/python.exe`) |
| **ML framework** | PyTorch 2.13 (CPU build) |
| **Vision** | OpenCV 5.0 |
| **Video processing** | FFmpeg / FFprobe |
| **Data storage** | CSV + JSON + JPG frames |
| **Deployment target** | ONNX Runtime (Windows, no deps) |

---

## 3. Directory Structure

```
Valo Detect AI/
├── Leakling_AI_Guide.md                  ← Phase-by-phase guide + decision log
├── phase-1-problem-definition.md         ← Taxonomy (7 cats, 32 subtypes), scope
├── phase-2-data-collection.md            ← Data strategy, pairing approach
├── Leakling_Pipeline_Handoff.md          ← THIS DOCUMENT
├── prelabels_Verified1 - prelabels.csv.csv  ← User-verified prelabels (source)
│
└── AI Training material/
    ├── My Gameplay/                       ← User's original match MP4s (13)
    ├── High elo gameplay/                 ← Pro scrim VODs (10)
    ├── Low elo gameplay/                  ← Low elo VODs (3)
    ├── Flawless gameplay/                 ← Highlight reels (4, auto-flawless)
    ├── Ingame maps and name labels/       ← Map layouts (AVIF, unused so far)
    ├── Masters London VODs/               ← 24 tournament VODs (reference source)
    │
    ├── scripts/                           ← All pipeline scripts (see §4)
    │
    ├── checkpoints/
    │   ├── best_model.pt                  ← Best model by val accuracy (129 MB)
    │   └── latest.pt                      ← Latest epoch model
    │
    ├── logs/
    │   ├── training_history.json          ← Epoch-by-epoch training log
    │   └── test_results.json
    │
    └── dataset/
        ├── raw/
        │   ├── matches/                   ← User's usable match videos (12 MP4)
        │   └── references/                ← Pro scrims + low elo + highlights (16)
        ├── processed/                     ← (trimmed clips, mostly empty)
        ├── paired/
        │   ├── train/  (217 pairs)        ← Paired flawed+flawless frames
        │   ├── val/    (46 pairs)
        │   └── test/   (48 pairs)
        ├── frames/                        ← (empty, frames live under paired/)
        └── metadata/
            ├── dataset_combined.csv       ← MASTER label file (525 rounds, 311 flawed)
            ├── Dataset3.csv               ← User's match labels
            ├── Dataset4.csv               ← Pro scrim labels
            ├── Dataset5.csv               ← Low elo labels
            ├── training_clips/training_clips.json  ← Generated clip timestamps
            ├── pairing_map_complete.json  ← Flawed↔flawless pairings
            ├── split_info.json            ← train/val/test assignment
            ├── dataset_index.csv          ← Training dataset index
            ├── prelabels/prelabels.csv    ← Model-generated prelabels
            └── demo/demo_detections.csv   ← Highest-confidence detections
```

---

## 4. Pipeline Scripts (in `AI Training material/scripts/`)

### Data Preparation
| Script | Function |
|--------|----------|
| `transcode_to_webm.ps1` | Convert MP4 → WebM (VP9, no audio) |
| `generate_training_clips.py` | Reads `dataset_combined.csv` → estimates frame timestamps per flawed round → writes `training_clips.json` |
| `phase4_feature_extraction.py` | Builds pairs (`--build-pairs`), extracts frames (`--extract-frames`), generates index (`--index`) |

### Training & Evaluation
| Script | Function |
|--------|----------|
| `phase5_model_training.py` | Trains Siamese ResNet-18 (dual-backbone support: resnet18 / resnet34 / efficientnet_b0). Early-stops by **val accuracy**, patience=3 |
| `evaluate_categories.py` | Reports subtype + category-level accuracy on test set |
| `demo_best_detections.py` | Finds highest-confidence detections for demo clips |

### Pre-labeling & Scanning
| Script | Function |
|--------|----------|
| `prelabel_unlabeled.py` | Uses trained model to guess labels on unlabeled footage |
| `flaw_window_detector.py` | CV-based flaw timestamp detection (heuristics) |
| `quick_scan.py` | Fast OpenCV video scanner |
| `flaw_scanner_fast.py` | FFmpeg+numpy scanner |
| `run_detector.ps1` / `run_scanner.ps1` | PowerShell wrappers |

### Auto-labeling (parked)
| Script | Function |
|--------|----------|
| `youtube_analysis_pipeline.py` | Parse analysis-video transcripts for flaw labels (parked — needs targeted analysis channels) |

---

## 5. End-to-End Pipeline Flow

```
Dataset3.csv + Dataset4.csv + Dataset5.csv (+ verified prelabels)
        │
        ▼
  dataset_combined.csv          ← MASTER LABELS (merge all sources)
        │
        ▼
  generate_training_clips.py    ← estimate timestamp per flawed round
        │
        ▼
  training_clips.json           ← (file, round, flaw_type, start/end sec)
        │
        ▼
  phase4_feature_extraction.py --build-pairs   ← flawed↔flawless pairing
        │
        ▼
  pairing_map_complete.json     ← 311 pairs + train/val/test split
        │
        ▼
  phase4_feature_extraction.py --extract-frames ← cut 5s clips to 224×224 JPGs
        │
        ▼
  dataset/paired/{train,val,test}/pair_XXXXX/{flawed_frames,flawless_frames,metadata.json}
        │
        ▼
  phase5_model_training.py      ← train Siamese ResNet-18, early stop on val acc
        │
        ▼
  checkpoints/best_model.pt     ← 129 MB model
        │
        ▼
  evaluate_categories.py        ← category/subtype accuracy
  demo_best_detections.py       ← find demo-worthy clips
  prelabel_unlabeled.py         ← auto-label new footage → verify loop
```

---

## 6. Data Pipeline Details

### Label Sources
- **Dataset3.csv** — User's own match labels (12 files, 240 rounds, 175 flawed)
- **Dataset4.csv** — Pro scrim labels (10 files, 219 rounds, 124 flawed)
- **Dataset5.csv** — Low elo labels (1 file, 23 rounds, 11 flawed)
- **prelabels_Verified1** — User-verified model prelabels (+49 flawed rounds merged)

### Master Dataset
- `dataset_combined.csv`: **525 rounds, 311 flawed** across 23 files
- Columns: `file_name, round_number, category, subtype, severity, has_flaw, notes, is_flawless_reference`
- **Corrupted/removed videos** (do NOT re-add):
  - `Valorant_07-15-2026_18-41-29-650`
  - `🌙 Breaking Through the Bronze Veil ｜ Valorant Ranked`
  - `Valorant ranked VOD #001⧸ Omen⧸ Bronze 1`

### Flawless References
- **4 highlight reels** auto-used as flawless references (in `dataset/raw/references/`)
- Fallback: round-start of same match if no highlight available

### Paired Dataset (current)
- Train: **217** | Val: **46** | Test: **48** = **311 pairs** (297 extracted OK, 14 failed from corrupted videos)
- Each pair: `flawed_frames/` (30-60 JPGs) + `flawless_frames/` (50 JPGs) + `metadata.json`
- Frames: 224×224 JPG, extracted at 10fps

---

## 7. Current Model State

| Metric | Value |
|--------|-------|
| Architecture | Siamese ResNet-18, 11.3M params, 128-dim embedding |
| Checkpoint | `best_model.pt` (129 MB), best epoch 7 |
| Best val accuracy | **23.8%** |
| Test subtype accuracy | **7.9%** (38 test pairs) |
| Test category accuracy | **21.1%** |
| Random baseline (subtype) | 3.2% (31 classes) |
| Random baseline (category) | 14.3% (7 categories) |

### Known Issues
1. **Positioning overfit** — model predicts PS-01/PS-05 too often. Fix: don't over-label positioning; prefer actual category when borderline.
2. **DM-02 bias** — model predicts "peek disadvantaged" frequently. Highest-confidence detections are mostly wrong (DM-02 predictions).
3. **Verified prelabels may reinforce model bias** — treat with caution; user-verified but derived from model guesses.

### Training Notes
- **Early stopping**: tracks **val accuracy** (not loss), patience = 3 epochs
- **Batch size**: 4 (to avoid OOM), **NUM_FRAMES**: 8
- **Loss weights**: contrastive 1.0, classification 0.5, severity 0.3
- **Unicode bug fixed**: print statements must NOT contain ✓/🎯/→ when redirecting output on Windows (CP1252). Use ASCII `[OK]`/`[STOP]`/`->`.

---

## 8. Deployment Plan (Phase 8/9 — Not Yet Built)

**Locked decisions:**
1. **Dual-model:** Keep ResNet-18 for post-match analysis + add EfficientNet-B0 (~35 MB) for live scanning (~10ms/frame CPU)
2. **ONNX export** for both → runs on any Windows PC with zero dependencies (bundle `onnxruntime.dll`, no Python/PyTorch needed)
3. **Electron + `desktopCapturer`** for live screen capture (scan every ~0.5s)
4. **Overwolf** for game integration / overlay
5. **Model update strategy:** separate model file + manifest check (hotfixes without app updates)

---

## 9. How to Run (Quick Reference)

```powershell
# IMPORTANT: use full python path
$py = "C:/Users/notiv/AppData/Local/Programs/Python/Python314/python.exe"
cd "C:\Users\notiv\OneDrive\Documents\MicroSaaS Projects\Overwolf Apps\Valo Detect AI\AI Training material\scripts"

# 1. Regenerate clip timestamps from labels
& $py -u generate_training_clips.py

# 2. Rebuild pairs + extract frames (delete paired/* first if rebuilding)
& $py -u phase4_feature_extraction.py --build-pairs
& $py -u phase4_feature_extraction.py --extract-frames

# 3. Train (run in background: use Start-Process with -WindowStyle Hidden to avoid
#    VS Code terminal cleanup killing it)
& $py -u phase5_model_training.py

# 4. Evaluate
& $py -u evaluate_categories.py

# 5. Find demo clips
& $py -u demo_best_detections.py --top 10

# 6. Pre-label new footage
& $py -u prelabel_unlabeled.py
```

---

## 10. Next Steps (Priority Order)

1. **Label more rounds** — especially crosshair (CP) and decision (DM), avoiding positioning overfit. Each labeled match ≈ +10-15 pairs.
2. **Verify more prelabels** (`prelabels.csv`) — the model's guesses, user corrects.
3. **Merge new labels → `dataset_combined.csv` → regenerate clips → rebuild pairs → retrain**
4. **Train EfficientNet-B0** as the lightweight live-scan model (already supported in `phase5_model_training.py`)
5. **Export to ONNX** (Phase 8) — write export script
6. **Build Electron live-scan + Overwolf integration** (Phase 9)
7. **For Riot demo:** use ONLY the user's own gameplay footage, never pro player VODs

---

*End of handoff document. New sessions should read §3 (structure), §4 (scripts), §6 (data state), §7 (model state), and §9 (run commands) first.*
