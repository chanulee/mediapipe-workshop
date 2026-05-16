// Small helpers used across the boilerplate.

export function clamp(v, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, v));
}

// Exponential smoothing. alpha is the weight on the new sample.
// Lower alpha = smoother but laggier. Higher alpha = snappier but jitterier.
//
//   let s = 0;
//   s = smooth(s, newValue, 0.2);
//
// Two-arg form keeps a private store keyed by call site label.
// (Use the three-arg form in tight loops.)
const _smoothStore = new Map();
export function smooth(prevOrValue, valueOrAlpha, alpha) {
  if (alpha === undefined) {
    // smooth(value, alpha) — uses an anonymous slot, returns smoothed value.
    // Caller is expected to keep their own previous value; this is a pure helper.
    // We just return value as-is in this form to avoid hidden state surprises.
    // Recommended usage is the three-arg form below.
    return prevOrValue;
  }
  return prevOrValue * (1 - alpha) + valueOrAlpha * alpha;
}

// Like p5's map(), but clamped to the output range.
export function mapRange(value, inMin, inMax, outMin, outMax) {
  const t = (value - inMin) / (inMax - inMin);
  const v = outMin + clamp(t, 0, 1) * (outMax - outMin);
  return v;
}

// Squash a value into 0..1.
export function normalise(value, min, max) {
  return clamp((value - min) / (max - min), 0, 1);
}

// Euclidean distance between two {x, y} or {x, y, z} points.
export function dist(a, b) {
  if (!a || !b) return 0;
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z ?? 0) - (b.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// Draw every landmark as a small dot, with index numbers.
// Useful for finding the right index when you're not sure what to name.
// Call this from p5's draw(); it uses the global p5 functions.
export function debugDraw(face, hands, opts = {}) {
  const w = (typeof width !== "undefined") ? width : 640;
  const h = (typeof height !== "undefined") ? height : 480;
  const showFaceLabels = opts.showFaceLabels === true; // off by default — 478 labels is loud
  const showHandLabels = opts.showHandLabels !== false;

  if (typeof push === "function") push();
  if (typeof noStroke === "function") noStroke();
  if (typeof textSize === "function") textSize(10);

  if (face && face.raw) {
    if (typeof fill === "function") fill(0, 255, 100, 180);
    face.raw.forEach((p, i) => {
      if (!p) return;
      if (typeof circle === "function") circle(p.x * w, p.y * h, 3);
      if (showFaceLabels && typeof text === "function") {
        text(i, p.x * w + 4, p.y * h);
      }
    });
  }

  if (hands && hands.length) {
    if (typeof fill === "function") fill(255, 60, 110, 200);
    hands.forEach((hand) => {
      if (!hand.raw) return;
      hand.raw.forEach((p, i) => {
        if (!p) return;
        if (typeof circle === "function") circle(p.x * w, p.y * h, 6);
        if (showHandLabels && typeof text === "function") {
          text(i, p.x * w + 6, p.y * h);
        }
      });
    });
  }

  if (typeof pop === "function") pop();
}
