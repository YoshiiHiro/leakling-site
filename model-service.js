/**
 * Leakling — ONNX Model Service (main process)
 * =============================================
 * Loads the exported combined Siamese flaw-detection model and runs inference.
 *
 * Model package (models/leakling/):
 *   - model.onnx (+ model.onnx.data) : combined model
 *   - manifest.json                  : metadata / input-output specs
 *   - flaw_types.json                : 31 flaw types (idx_to_flaw)
 *
 * Model interface:
 *   Inputs:
 *     flawed_clip   : (1, 8, 3, 224, 224) float32, ImageNet-normalized
 *     flawless_clip : (1, 8, 3, 224, 224) float32, ImageNet-normalized
 *   Outputs:
 *     flaw_type_logits, flaw_type_probs, severity,
 *     top_flaw_prob, top_flaw_index, embedding
 *
 * Uses onnxruntime-node (bundled native runtime, no Python needed).
 */
const path = require('path');
const fs = require('fs');
const { Tensor, InferenceSession } = require('onnxruntime-node');

const MODELS_DIR = path.join(__dirname, 'models', 'leakling');
const MODEL_PATH = path.join(MODELS_DIR, 'model.onnx');
const MANIFEST_PATH = path.join(MODELS_DIR, 'manifest.json');
const FLAW_TYPES_PATH = path.join(MODELS_DIR, 'flaw_types.json');

const NUM_FRAMES = 8;
const FRAME_SIZE = 224;

let session = null;
let manifest = null;
let flawTypes = null;
let flawNames = null;
let loadPromise = null;

/** Load the ONNX session (idempotent). */
function loadModels() {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    if (!fs.existsSync(MODEL_PATH)) {
      throw new Error('ONNX model not found: ' + MODEL_PATH);
    }
    session = await InferenceSession.create(MODEL_PATH, { executionProviders: ['cpu'] });

    if (fs.existsSync(MANIFEST_PATH)) {
      manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
    }
    if (fs.existsSync(FLAW_TYPES_PATH)) {
      const ft = JSON.parse(fs.readFileSync(FLAW_TYPES_PATH, 'utf-8'));
      if (ft.idx_to_flaw) flawTypes = Object.values(ft.idx_to_flaw);
      else flawTypes = ft.flaw_types || ft;
      if (ft.idx_to_name) flawNames = Object.values(ft.idx_to_name);
    }

    return { loaded: true, flawTypes, flawNames, numFrames: NUM_FRAMES, frameSize: FRAME_SIZE };
  })();
  return loadPromise;
}

/**
 * Build a clip tensor from a list of normalized frames.
 * Each frame is a Float32Array/array of length 224*224*3.
 * @param {Float32Array[]|number[][]} frames
 * @param {number} n - target frame count (repeats last to pad)
 * @returns {Tensor} - (1, n, 3, 224, 224)
 */
function buildClipTensor(frames, n = NUM_FRAMES) {
  const src = frames.slice(0, n);
  const empty = new Float32Array(FRAME_SIZE * FRAME_SIZE * 3);
  while (src.length < n) src.push(src[src.length - 1] || empty);

  const data = new Float32Array(n * 3 * FRAME_SIZE * FRAME_SIZE);
  src.forEach((frame, t) => {
    data.set(frame, t * 3 * FRAME_SIZE * FRAME_SIZE);
  });
  return new Tensor('float32', data, [1, n, 3, FRAME_SIZE, FRAME_SIZE]);
}

/**
 * Run the full model on a flawed + flawless clip pair.
 * @param {Float32Array[]|number[][]} flawedFrames
 * @param {Float32Array[]|number[][]} flawlessFrames
 * @returns {Promise<{ flawIndex:number, flawType:string, confidence:number, severity:number, logits:number[], probs:number[] }>}
 */
async function detectFlaw(flawedFrames, flawlessFrames) {
  if (!session) await loadModels();

  const flawedClip = buildClipTensor(flawedFrames);
  const flawlessClip = buildClipTensor(flawlessFrames);

  const results = await session.run({
    flawed_clip: flawedClip,
    flawless_clip: flawlessClip,
  });

  const index = Math.round(results.top_flaw_index.data[0]);
  const confidence = results.top_flaw_prob ? results.top_flaw_prob.data[0] : 0;
  const severity = results.severity ? results.severity.data[0] : 0;

  const flawType = (flawTypes && flawTypes[index]) || `IDX_${index}`;
  const flawName = (flawNames && flawNames[index]) || flawType;

  return {
    flawIndex: index,
    flawType,
    flawName,
    confidence,
    severity,
    logits: results.flaw_type_logits ? Array.from(results.flaw_type_logits.data) : [],
    probs: results.flaw_type_probs ? Array.from(results.flaw_type_probs.data) : [],
  };
}

module.exports = {
  loadModels,
  detectFlaw,
  getMetadata: () => manifest,
  getFlawTypes: () => flawTypes,
  getFlawNames: () => flawNames,
  getModelsDir: () => MODELS_DIR,
  NUM_FRAMES,
  FRAME_SIZE,
};

