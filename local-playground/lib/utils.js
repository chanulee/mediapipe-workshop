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

// "Cover-fit" rectangle the video occupies inside a canvas of size (w, h).
// Mediapipe landmarks are normalised against the *video* — convert them with toCanvas().
export function videoFit(video, w, h) {
  if (!video || !video.videoWidth) return { dx: 0, dy: 0, dw: w, dh: h };
  const srcRatio = video.videoWidth / video.videoHeight;
  const dstRatio = w / h;
  let dw, dh;
  if (srcRatio > dstRatio) { dh = h; dw = dh * srcRatio; }
  else                     { dw = w; dh = dw / srcRatio; }
  return { dx: (w - dw) / 2, dy: (h - dh) / 2, dw, dh };
}

// Map a normalised landmark {x, y} to canvas pixels using the video's fit rect.
// The tracker already mirrors landmarks when flip:true, and drawVideo mirrors
// the video, so this single formula works in both mirrored and unmirrored modes.
export function toCanvas(pt, fit) {
  return { x: fit.dx + pt.x * fit.dw, y: fit.dy + pt.y * fit.dh };
}

// Draw the live webcam feed as a cover-fit background.
// Uses the raw 2D context because p5's image() doesn't accept HTMLVideoElement.
// Pass `drawingContext` from your p5 sketch.
export function drawVideo(video, ctx, w, h, opts = {}) {
  if (!video || video.readyState < 2 || !video.videoWidth) return;
  const mirror  = opts.mirror  !== false;     // default true
  const opacity = opts.opacity ?? 1;
  const { dx, dy, dw, dh } = videoFit(video, w, h);

  ctx.save();
  ctx.globalAlpha = opacity;
  if (mirror) { ctx.translate(w, 0); ctx.scale(-1, 1); }
  ctx.drawImage(video, dx, dy, dw, dh);
  ctx.restore();
}

// Draw every landmark as a small dot, with index numbers.
// Useful for finding the right index when you're not sure what to name.
// Call this from p5's draw(); it uses the global p5 functions.
export function debugDraw(face, hands, opts = {}) {
  const w = (typeof width !== "undefined") ? width : 640;
  const h = (typeof height !== "undefined") ? height : 480;
  // If a fit isn't supplied, fall back to full-canvas mapping. Callers that
  // also call drawVideo() should pass the same fit so landmarks line up.
  const fit = opts.fit || { dx: 0, dy: 0, dw: w, dh: h };
  const showFaceLabels = opts.showFaceLabels === true;
  const showHandLabels = opts.showHandLabels !== false;

  if (typeof push === "function") push();
  if (typeof noStroke === "function") noStroke();
  if (typeof textSize === "function") textSize(10);

  if (face && face.raw) {
    if (typeof fill === "function") fill(0, 255, 100, 200);
    face.raw.forEach((p, i) => {
      if (!p) return;
      const x = fit.dx + p.x * fit.dw;
      const y = fit.dy + p.y * fit.dh;
      if (typeof circle === "function") circle(x, y, 3);
      if (showFaceLabels && typeof text === "function") text(i, x + 4, y);
    });
  }

  if (hands && hands.length) {
    if (typeof fill === "function") fill(255, 60, 110, 220);
    hands.forEach((hand) => {
      if (!hand.raw) return;
      hand.raw.forEach((p, i) => {
        if (!p) return;
        const x = fit.dx + p.x * fit.dw;
        const y = fit.dy + p.y * fit.dh;
        if (typeof circle === "function") circle(x, y, 6);
        if (showHandLabels && typeof text === "function") text(i, x + 6, y);
      });
    });
  }

  if (typeof pop === "function") pop();
}
