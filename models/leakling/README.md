# Leakling Model Package

This folder contains the trained Leakling flaw-detection model, exported for
import into the main Leakling project.

## Files
- `model.onnx` — Deployment model (zero-dependency, runs with ONNX Runtime)
- `model.pt` — PyTorch checkpoint (for reference / further retraining)
- `manifest.json` — Model metadata, metrics, and input/output specs
- `flaw_types.json` — Category + subtype definitions

## Import into the main project (Electron)

### Option A: ONNX Runtime (recommended for shipping)
```bash
npm install onnxruntime-node
```

```javascript
const ort = require('onnxruntime-node');
const fs = require('fs');

async function loadLeakling() {
  return await ort.InferenceSession.create('./leakling/model.onnx');
}

// Input: two clips of shape (1, 8, 3, 224, 224) normalized with
// mean=[0.485,0.456,0.406], std=[0.229,0.224,0.225]
async function detect(session, flawedClip, flawlessClip) {
  const results = await session.run({
    'flawed_clip': flawedClip,
    'flawless_clip': flawlessClip,
  });
  return {
    flawTypeIndex: Math.round(results['top_flaw_index'].data[0]),
    confidence: results['top_flaw_prob'].data[0],
    severity: results['severity'].data[0],
  };
}
```

### Option B: Python (for internal tooling)
```python
import onnxruntime as ort
import numpy as np

session = ort.InferenceSession("exports/leakling/model.onnx")
flawed = np.random.randn(1, 8, 3, 224, 224).astype(np.float32)
flawless = np.random.randn(1, 8, 3, 224, 224).astype(np.float32)
out = session.run(None, {"flawed_clip": flawed, "flawless_clip": flawless})
```

## Notes
- Inputs are CLIPS (8 frames each), not single frames.
- Frames must be 224x224 RGB, normalized with ImageNet stats.
- `top_flaw_index` maps to `flaw_types.json` -> `idx_to_flaw`.
