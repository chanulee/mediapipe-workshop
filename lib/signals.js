// Derived signals: clean 0..1 / -1..1 numbers computed from raw landmarks.
//
// Each compute*Signals function takes:
//   raw        — array of landmarks ({x, y, z} in normalised 0..1 space)
//   smoothing  — 0..1, weight on previous frame's signal (higher = smoother)
//   prev       — the previously wrapped result (face/hand) for temporal smoothing
//
// and returns an object of named signals.

import {
  NOSE_TIP, FOREHEAD, CHIN,
  LEFT_EYE, RIGHT_EYE,
  LEFT_BROW, RIGHT_BROW,
  UPPER_LIP, LOWER_LIP, LEFT_MOUTH, RIGHT_MOUTH,
  LEFT_CHEEK, RIGHT_CHEEK,
  WRIST,
  THUMB_TIP, INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP,
  INDEX_KNUCKLE, MIDDLE_KNUCKLE, RING_KNUCKLE, PINKY_KNUCKLE,
  INDEX_MID, MIDDLE_MID, RING_MID, PINKY_MID,
  THUMB_MCP, THUMB_IP,
} from "./landmarks.js";
import { dist, clamp, mapRange } from "./utils.js";

function blend(prev, next, smoothing) {
  if (prev == null || Number.isNaN(prev)) return next;
  return prev * smoothing + next * (1 - smoothing);
}

// ---------- Face ----------
export function computeFaceSignals(raw, smoothing = 0.5, prev = null) {
  const prevS = prev?.signals || {};

  const faceHeight = dist(raw[FOREHEAD], raw[CHIN]) || 1;
  const faceWidth  = dist(raw[LEFT_CHEEK], raw[RIGHT_CHEEK]) || 1;

  // mouthOpen — vertical lip gap / face height. Closed ~0.02, wide open ~0.18+.
  const lipGap = dist(raw[UPPER_LIP], raw[LOWER_LIP]);
  const mouthOpenRaw = mapRange(lipGap / faceHeight, 0.02, 0.18, 0, 1);

  // smile — horizontal mouth-corner spread / face width. Neutral ~0.34, grin ~0.5.
  const mouthSpan = dist(raw[LEFT_MOUTH], raw[RIGHT_MOUTH]);
  const smileRaw = mapRange(mouthSpan / faceWidth, 0.32, 0.5, 0, 1);

  // eyebrowRaise — avg brow-to-eye vertical distance / face height.
  // Eyes are below brows, so eye.y > brow.y. Larger gap when brows raised.
  const leftGap  = (raw[LEFT_EYE].y  - raw[LEFT_BROW].y);
  const rightGap = (raw[RIGHT_EYE].y - raw[RIGHT_BROW].y);
  const browGap  = (leftGap + rightGap) / 2;
  const eyebrowRaiseRaw = mapRange(browGap / faceHeight, 0.04, 0.10, 0, 1);

  // headTilt — angle of the eye line, normalised so ±1 ≈ ±45°.
  const dx = raw[RIGHT_EYE].x - raw[LEFT_EYE].x;
  const dy = raw[RIGHT_EYE].y - raw[LEFT_EYE].y;
  const tiltAngle = Math.atan2(dy, dx); // ~0 when level
  const headTiltRaw = clamp(tiltAngle / (Math.PI / 4), -1, 1);

  return {
    mouthOpen:    blend(prevS.mouthOpen,    mouthOpenRaw,    smoothing),
    smile:        blend(prevS.smile,        smileRaw,        smoothing),
    eyebrowRaise: blend(prevS.eyebrowRaise, eyebrowRaiseRaw, smoothing),
    headTilt:     blend(prevS.headTilt,     headTiltRaw,     smoothing),
  };
}

// ---------- Hand ----------
const FINGER_CHAINS = [
  // [tip, pip, mcp]   — for is-finger-extended test (skip thumb here)
  [INDEX_TIP,  INDEX_MID,  INDEX_KNUCKLE],
  [MIDDLE_TIP, MIDDLE_MID, MIDDLE_KNUCKLE],
  [RING_TIP,   RING_MID,   RING_KNUCKLE],
  [PINKY_TIP,  PINKY_MID,  PINKY_KNUCKLE],
];

function isFingerExtended(raw, tip, pip, mcp) {
  // Extended if tip is farther from wrist than pip is from wrist.
  const wrist = raw[WRIST];
  return dist(raw[tip], wrist) > dist(raw[pip], wrist) * 1.05;
}

function isThumbExtended(raw) {
  // Thumb extended if tip is far from index MCP relative to thumb MCP.
  return dist(raw[THUMB_TIP], raw[INDEX_KNUCKLE]) > dist(raw[THUMB_IP], raw[INDEX_KNUCKLE]) * 1.1;
}

export function computeHandSignals(raw, smoothing = 0.5, prev = null) {
  const prevS = prev?.signals || {};

  // Hand size: wrist to middle-finger knuckle. Stable scale reference.
  const handSize = dist(raw[WRIST], raw[MIDDLE_KNUCKLE]) || 1;

  // pinch — thumb-to-index distance / hand size. 1 when touching, 0 when apart.
  const pinchDist = dist(raw[THUMB_TIP], raw[INDEX_TIP]) / handSize;
  const pinchRaw = 1 - mapRange(pinchDist, 0.2, 1.2, 0, 1);

  // openness — avg fingertip-to-wrist distance / hand size.
  const tips = [INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP];
  const avgReach = tips.reduce((s, i) => s + dist(raw[i], raw[WRIST]), 0) / tips.length;
  const opennessRaw = mapRange(avgReach / handSize, 1.2, 2.2, 0, 1);

  // fingerCount — extended fingers including thumb.
  let fingerCount = 0;
  for (const [tip, pip, mcp] of FINGER_CHAINS) {
    if (isFingerExtended(raw, tip, pip, mcp)) fingerCount++;
  }
  if (isThumbExtended(raw)) fingerCount++;

  // pointing — only the index is extended.
  const indexUp  = isFingerExtended(raw, INDEX_TIP,  INDEX_MID,  INDEX_KNUCKLE);
  const middleUp = isFingerExtended(raw, MIDDLE_TIP, MIDDLE_MID, MIDDLE_KNUCKLE);
  const ringUp   = isFingerExtended(raw, RING_TIP,   RING_MID,   RING_KNUCKLE);
  const pinkyUp  = isFingerExtended(raw, PINKY_TIP,  PINKY_MID,  PINKY_KNUCKLE);
  const pointing = indexUp && !middleUp && !ringUp && !pinkyUp;

  return {
    pinch:       clamp(blend(prevS.pinch,    pinchRaw,    smoothing), 0, 1),
    openness:    clamp(blend(prevS.openness, opennessRaw, smoothing), 0, 1),
    pointing,
    fingerCount,
  };
}
