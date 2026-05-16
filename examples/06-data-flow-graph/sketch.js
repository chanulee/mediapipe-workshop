// TouchDesigner-style data-flow graph for the workshop pipeline.
// Each node represents a real stage (camera → MediaPipe models → derived
// signals → renderer). Ports + connections show *which* piece of data hops
// where, and the renderer node hosts the actual p5 sketch output as a thumbnail.
//
// Controls:
//   • drag empty space  → pan
//   • wheel             → zoom toward cursor
//   • node param inputs → live config (smoothing, render toggles, etc.)
//   • toolbar           → fit / reset / pause

import { Tracker } from "../../lib/tracker.js";
import { videoFit, toCanvas } from "../../lib/utils.js";

// ---------- shared runtime config ----------
const renderCfg = {
  mirror: true,
  showCamera: true,
  showFacePoints: true,
  showHandPoints: true,
  showLandmarkLabels: false,
  opacity: 1.0,
  paused: false,
};

const tracker = new Tracker({ face: true, hands: true, maxHands: 2, smoothing: 0.5 });

let face = null;
let hands = [];
let video = null;
let trackerFps = 0;
let lastTickAt = 0;

tracker.onUpdate((d) => {
  if (renderCfg.paused) return;
  face = d.face;
  hands = d.hands;
  video = d.video;
  const now = performance.now();
  if (lastTickAt) {
    const fps = 1000 / (now - lastTickAt);
    trackerFps = trackerFps ? trackerFps * 0.9 + fps * 0.1 : fps;
  }
  lastTickAt = now;
});

// ---------- node definitions ----------
// col: 0..3 column index. stack: top|middle|bottom for vertical order in column.
// ins/outs: { key, label, kind } — kind drives port-dot colour.
const NODES = [
  {
    id: "camera", title: "Camera", type: "video source", col: 0, stack: "middle",
    ins: [],
    outs: [{ key: "video", label: "video", kind: "video" }],
    body: () => `
      <div class="section-label">preview</div>
      <div class="thumb"><canvas id="thumb-camera" width="200" height="120"></canvas></div>
      <div class="kv"><span class="k">resolution</span><span class="v" data-bind="cam-res">—</span></div>
      <div class="kv"><span class="k">readyState</span><span class="v" data-bind="cam-ready">—</span></div>
      <div class="kv"><span class="k">fps</span><span class="v" data-bind="cam-fps">—</span></div>
    `,
  },
  {
    id: "faceLm", title: "Face Landmarker", type: "mediapipe model", col: 1, stack: "top",
    ins:  [{ key: "video",     label: "video",     kind: "video" }],
    outs: [
      { key: "landmarks", label: "landmarks (478)", kind: "landmarks" },
      { key: "bbox",      label: "bbox",            kind: "landmarks" },
    ],
    body: () => `
      <div class="kv"><span class="k">numFaces</span><span class="v">1</span></div>
      <div class="kv"><span class="k">delegate</span><span class="v">GPU</span></div>
      <div class="kv"><span class="k">faces detected</span><span class="v" data-bind="face-count">0</span></div>
      <div class="kv"><span class="k">nose (norm)</span><span class="v" data-bind="face-nose">—</span></div>
    `,
  },
  {
    id: "handLm", title: "Hand Landmarker", type: "mediapipe model", col: 1, stack: "bottom",
    ins:  [{ key: "video",     label: "video",          kind: "video" }],
    outs: [
      { key: "landmarks", label: "landmarks (21/hand)", kind: "landmarks" },
      { key: "handedness", label: "handedness",         kind: "landmarks" },
    ],
    body: () => `
      <div class="kv"><span class="k">maxHands</span><span class="v">2</span></div>
      <div class="kv"><span class="k">delegate</span><span class="v">GPU</span></div>
      <div class="kv"><span class="k">hands detected</span><span class="v" data-bind="hand-count">0</span></div>
      <div class="kv"><span class="k">handedness</span><span class="v" data-bind="hand-which">—</span></div>
    `,
  },
  {
    id: "faceSig", title: "Face Signals", type: "derived", col: 2, stack: "top",
    ins:  [{ key: "landmarks", label: "landmarks", kind: "landmarks" }],
    outs: [
      { key: "mouthOpen",    label: "mouthOpen",    kind: "signals" },
      { key: "smile",        label: "smile",        kind: "signals" },
      { key: "eyebrowRaise", label: "eyebrowRaise", kind: "signals" },
      { key: "headTilt",     label: "headTilt",     kind: "signals" },
    ],
    body: () => `
      <div class="section-label">params</div>
      <div class="param">
        <label>smoothing</label>
        <input type="range" min="0" max="0.95" step="0.01" value="0.5" data-param="smoothing">
        <span class="v" data-bind="face-smoothing">0.50</span>
      </div>
    `,
  },
  {
    id: "handSig", title: "Hand Signals", type: "derived", col: 2, stack: "bottom",
    ins:  [{ key: "landmarks", label: "landmarks", kind: "landmarks" }],
    outs: [
      { key: "pinch",       label: "pinch",       kind: "signals" },
      { key: "openness",    label: "openness",    kind: "signals" },
      { key: "pointing",    label: "pointing",    kind: "signals" },
      { key: "fingerCount", label: "fingerCount", kind: "signals" },
    ],
    body: () => `
      <div class="section-label">params (shared)</div>
      <div class="param">
        <label>smoothing</label>
        <input type="range" min="0" max="0.95" step="0.01" value="0.5" data-param="smoothing">
        <span class="v" data-bind="hand-smoothing">0.50</span>
      </div>
    `,
  },
  {
    id: "render", title: "Renderer (p5.js)", type: "output", col: 3, stack: "middle",
    ins: [
      { key: "video",         label: "video",         kind: "video" },
      { key: "faceLandmarks", label: "faceLandmarks", kind: "landmarks" },
      { key: "handLandmarks", label: "handLandmarks", kind: "landmarks" },
      { key: "faceSignals",   label: "faceSignals",   kind: "signals" },
      { key: "handSignals",   label: "handSignals",   kind: "signals" },
    ],
    outs: [],
    body: () => `
      <div class="section-label">canvas</div>
      <div class="thumb"><div id="thumb-render-wrap"></div></div>
      <div class="section-label">params</div>
      <label class="cb"><input type="checkbox" data-rcfg="showCamera"      checked> show camera</label>
      <label class="cb"><input type="checkbox" data-rcfg="mirror"          checked> mirror</label>
      <label class="cb"><input type="checkbox" data-rcfg="showFacePoints"  checked> face landmarks</label>
      <label class="cb"><input type="checkbox" data-rcfg="showHandPoints"  checked> hand landmarks</label>
      <label class="cb"><input type="checkbox" data-rcfg="showLandmarkLabels"> show indices</label>
      <div class="param">
        <label>opacity</label>
        <input type="range" min="0" max="1" step="0.01" value="1" data-rcfg-range="opacity">
        <span class="v" data-bind="render-opacity">1.00</span>
      </div>
    `,
  },
];

const EDGES = [
  // source/srcPort  →  dest/dstPort                          kind         signal that "data is flowing"
  { src: "camera",  srcPort: "video",     dst: "faceLm",  dstPort: "video",         kind: "video",     active: () => hasVideo() },
  { src: "camera",  srcPort: "video",     dst: "handLm",  dstPort: "video",         kind: "video",     active: () => hasVideo() },
  { src: "camera",  srcPort: "video",     dst: "render",  dstPort: "video",         kind: "video",     active: () => hasVideo() && renderCfg.showCamera },
  { src: "faceLm",  srcPort: "landmarks", dst: "faceSig", dstPort: "landmarks",     kind: "landmarks", active: () => !!face },
  { src: "handLm",  srcPort: "landmarks", dst: "handSig", dstPort: "landmarks",     kind: "landmarks", active: () => hands.length > 0 },
  { src: "faceLm",  srcPort: "landmarks", dst: "render",  dstPort: "faceLandmarks", kind: "landmarks", active: () => !!face  && renderCfg.showFacePoints },
  { src: "handLm",  srcPort: "landmarks", dst: "render",  dstPort: "handLandmarks", kind: "landmarks", active: () => hands.length > 0 && renderCfg.showHandPoints },
  { src: "faceSig", srcPort: "*",         dst: "render",  dstPort: "faceSignals",   kind: "signals",   active: () => !!face },
  { src: "handSig", srcPort: "*",         dst: "render",  dstPort: "handSignals",   kind: "signals",   active: () => hands.length > 0 },
];

function hasVideo() { return !!(video && video.readyState >= 2 && video.videoWidth); }

// ---------- build DOM ----------
const nodesLayer = document.getElementById("nodes");
const svg = document.getElementById("edges");
const nodeEls = {};

for (const n of NODES) {
  const el = document.createElement("div");
  el.className = "node" + (n.id === "render" ? " render" : "");
  el.dataset.nodeId = n.id;
  el.innerHTML = `
    <div class="header">
      <span class="status"></span>
      <div class="title-block">
        <div class="name">${n.title}</div>
        <div class="type">${n.type}</div>
      </div>
    </div>
    <div class="io">
      ${n.ins.map((p) => portHtml(p, "in")).join("")}
      ${n.outs.map((p) => portHtml(p, "out")).join("")}
    </div>
    ${n.body ? n.body() : ""}
  `;
  nodesLayer.appendChild(el);
  nodeEls[n.id] = el;
}

function portHtml(p, side) {
  return `
    <div class="port" data-side="${side}" data-port-id="${p.key}" data-kind="${p.kind}">
      <span class="dot"></span>
      <span class="label">${p.label}</span>
      <span class="val" data-bind="${side}-${p.key}"></span>
    </div>
  `;
}

// build SVG edges + pulses
const edgeEls = []; // { edge, path, pulse }
for (const e of EDGES) {
  const id = `edge-${e.src}-${e.srcPort}--${e.dst}-${e.dstPort}`;
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("id", id);
  path.setAttribute("class", `edge ${e.kind}`);
  svg.appendChild(path);

  // small travelling pulse
  const pulse = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  pulse.setAttribute("class", `pulse ${e.kind}`);
  pulse.setAttribute("r", "3.5");
  const motion = document.createElementNS("http://www.w3.org/2000/svg", "animateMotion");
  motion.setAttribute("dur", "1.6s");
  motion.setAttribute("repeatCount", "indefinite");
  motion.setAttribute("rotate", "auto");
  const mpath = document.createElementNS("http://www.w3.org/2000/svg", "mpath");
  mpath.setAttribute("href", `#${id}`);
  mpath.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", `#${id}`);
  motion.appendChild(mpath);
  pulse.appendChild(motion);
  svg.appendChild(pulse);

  edgeEls.push({ edge: e, path, pulse });
}

// ---------- preview thumbnails ----------
// Camera thumb: plain canvas, raw video each frame.
const camThumb = document.getElementById("thumb-camera");
const camCtx = camThumb.getContext("2d");

// Renderer thumb: p5 sketch driven by renderCfg.
const RENDER_W = 246;
const RENDER_H = 184;
new p5((p) => {
  p.setup = () => {
    const c = p.createCanvas(RENDER_W, RENDER_H);
    c.parent("thumb-render-wrap");
    p.noStroke();
  };
  p.draw = () => {
    p.background(8);
    if (!hasVideo()) return;
    const fit = videoFit(video, RENDER_W, RENDER_H);
    const ctx = p.drawingContext;

    if (renderCfg.showCamera) {
      ctx.save();
      ctx.globalAlpha = renderCfg.opacity;
      if (renderCfg.mirror) { ctx.translate(RENDER_W, 0); ctx.scale(-1, 1); }
      ctx.drawImage(video, fit.dx, fit.dy, fit.dw, fit.dh);
      ctx.restore();
    }
    // Note: landmarks are already in (potentially) mirrored space because the
    // tracker has flip:true. The fit math is symmetric so points stay correct
    // whether the camera image was mirrored or not.
    // Landmarks are pre-mirrored by the tracker (flip:true). If the user
    // turns the preview's mirror off we un-flip x so dots track the raw image.
    const mapX = (x) => fit.dx + (renderCfg.mirror ? x : 1 - x) * fit.dw;
    const mapY = (y) => fit.dy + y * fit.dh;

    if (renderCfg.showFacePoints && face) {
      p.fill(120, 220, 130, 220);
      p.textSize(8);
      for (let i = 0; i < face.raw.length; i++) {
        const pt = face.raw[i];
        const x = mapX(pt.x), y = mapY(pt.y);
        p.circle(x, y, 1.5);
        if (renderCfg.showLandmarkLabels && i % 25 === 0) p.text(i, x + 2, y);
      }
    }
    if (renderCfg.showHandPoints) {
      p.fill(255, 110, 160, 230);
      p.textSize(8);
      for (const h of hands) {
        for (let i = 0; i < h.raw.length; i++) {
          const pt = h.raw[i];
          const x = mapX(pt.x), y = mapY(pt.y);
          p.circle(x, y, 2.5);
          if (renderCfg.showLandmarkLabels) p.text(i, x + 3, y);
        }
      }
    }
  };
});

// ---------- layout ----------
const PAD_X = 60;
const COL_GAP = 90;
const ROW_GAP = 36;

function layout() {
  // Group + sort by stack
  const order = { top: 0, middle: 1, bottom: 2 };
  const cols = [[], [], [], []];
  for (const n of NODES) cols[n.col].push(n);
  for (const c of cols) c.sort((a, b) => order[a.stack] - order[b.stack]);

  // Column widths use the widest node in that column.
  const colW = cols.map((arr) => Math.max(0, ...arr.map((n) => nodeEls[n.id].offsetWidth)));
  const xs = [PAD_X];
  for (let i = 1; i < 4; i++) xs[i] = xs[i - 1] + colW[i - 1] + COL_GAP;

  const vh = window.innerHeight;

  for (let c = 0; c < 4; c++) {
    const items = cols[c];
    if (!items.length) continue;
    const heights = items.map((n) => nodeEls[n.id].offsetHeight);
    const totalH = heights.reduce((s, h) => s + h, 0) + (items.length - 1) * ROW_GAP;
    let y = Math.max(80, (vh - totalH) / 2);
    for (let i = 0; i < items.length; i++) {
      const el = nodeEls[items[i].id];
      const dx = (colW[c] - el.offsetWidth) / 2;
      el.style.left = `${xs[c] + dx}px`;
      el.style.top  = `${Math.round(y)}px`;
      y += heights[i] + ROW_GAP;
    }
  }

  drawEdges();
  fitInitially();
}

function portAnchor(nodeId, portKey, side) {
  const el = nodeEls[nodeId];
  const nx = parseFloat(el.style.left || "0");
  const ny = parseFloat(el.style.top  || "0");
  const nw = el.offsetWidth;
  const nh = el.offsetHeight;
  if (portKey === "*") {
    return { x: side === "out" ? nx + nw : nx, y: ny + nh / 2 };
  }
  const portEl = el.querySelector(`.port[data-side="${side}"][data-port-id="${portKey}"]`);
  if (!portEl) return { x: side === "out" ? nx + nw : nx, y: ny + nh / 2 };
  const cy = portEl.offsetTop + portEl.offsetHeight / 2;
  return { x: side === "out" ? nx + nw : nx, y: ny + cy };
}

function drawEdges() {
  for (const { edge: e, path } of edgeEls) {
    const a = portAnchor(e.src, e.srcPort, "out");
    const b = portAnchor(e.dst, e.dstPort, "in");
    const dx = Math.max(40, Math.abs(b.x - a.x) * 0.5);
    const d = `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
    path.setAttribute("d", d);
  }
}

// ---------- pan / zoom ----------
const stage = document.getElementById("stage");
const canvasEl = document.getElementById("canvas");
let panX = 0, panY = 0, zoom = 1;
let initialFitDone = false;

function applyTransform() {
  canvasEl.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
  document.getElementById("zoom-readout").textContent = `${Math.round(zoom * 100)}%`;
}

function getContentBBox() {
  const xs = [], ys = [], xs2 = [], ys2 = [];
  for (const n of NODES) {
    const el = nodeEls[n.id];
    const x = parseFloat(el.style.left || "0");
    const y = parseFloat(el.style.top  || "0");
    xs.push(x); ys.push(y);
    xs2.push(x + el.offsetWidth);
    ys2.push(y + el.offsetHeight);
  }
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs2) - Math.min(...xs), h: Math.max(...ys2) - Math.min(...ys) };
}

function fitToView(margin = 60) {
  const bb = getContentBBox();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const sx = (vw - margin * 2) / bb.w;
  const sy = (vh - margin * 2) / bb.h;
  zoom = Math.min(1, Math.min(sx, sy));
  panX = (vw  - bb.w * zoom) / 2 - bb.x * zoom;
  panY = (vh  - bb.h * zoom) / 2 - bb.y * zoom;
  applyTransform();
}

function fitInitially() {
  if (initialFitDone) return;
  initialFitDone = true;
  // Wait one frame so nodes have settled sizes (thumbnails mount async).
  requestAnimationFrame(() => { fitToView(); });
}

stage.addEventListener("wheel", (e) => {
  e.preventDefault();
  const delta = -e.deltaY * 0.0015;
  const newZoom = Math.max(0.25, Math.min(2.5, zoom * (1 + delta)));
  // Zoom toward cursor — keep the point under the mouse stationary.
  const k = newZoom / zoom;
  panX = e.clientX - k * (e.clientX - panX);
  panY = e.clientY - k * (e.clientY - panY);
  zoom = newZoom;
  applyTransform();
}, { passive: false });

let dragging = false, dragStartX = 0, dragStartY = 0, panStartX = 0, panStartY = 0;
stage.addEventListener("pointerdown", (e) => {
  // Only pan when starting on empty space (not on a node/control).
  if (e.target.closest(".node")) return;
  dragging = true;
  stage.classList.add("dragging");
  dragStartX = e.clientX;  dragStartY = e.clientY;
  panStartX = panX;        panStartY = panY;
  stage.setPointerCapture(e.pointerId);
});
stage.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  panX = panStartX + (e.clientX - dragStartX);
  panY = panStartY + (e.clientY - dragStartY);
  applyTransform();
});
stage.addEventListener("pointerup", (e) => {
  dragging = false;
  stage.classList.remove("dragging");
  try { stage.releasePointerCapture(e.pointerId); } catch {}
});

// ---------- toolbar ----------
document.querySelector('[data-action="fit"]').addEventListener("click", () => fitToView());
document.querySelector('[data-action="reset"]').addEventListener("click", () => {
  panX = 0; panY = 0; zoom = 1; applyTransform();
});
const pauseBtn = document.getElementById("pause-btn");
pauseBtn.addEventListener("click", () => {
  renderCfg.paused = !renderCfg.paused;
  pauseBtn.textContent = renderCfg.paused ? "resume" : "pause";
  // Actually pause the <video> too — the tracker only fires when the video's
  // currentTime advances, so this freezes detection and previews together.
  if (video) {
    if (renderCfg.paused) video.pause();
    else video.play().catch(() => {});
  }
});

// ---------- node param wiring ----------
// Smoothing sliders (on Face Signals + Hand Signals) — both write to the
// shared tracker.opts.smoothing and stay in sync.
function bindSmoothing() {
  const sliders = document.querySelectorAll('input[data-param="smoothing"]');
  for (const s of sliders) {
    s.addEventListener("input", () => {
      const v = parseFloat(s.value);
      tracker.opts.smoothing = v;
      for (const other of sliders) if (other !== s) other.value = String(v);
      document.querySelector('[data-bind="face-smoothing"]').textContent = v.toFixed(2);
      document.querySelector('[data-bind="hand-smoothing"]').textContent = v.toFixed(2);
    });
  }
}
function bindRenderCfg() {
  for (const cb of document.querySelectorAll("[data-rcfg]")) {
    cb.addEventListener("change", () => { renderCfg[cb.dataset.rcfg] = cb.checked; });
  }
  for (const r of document.querySelectorAll("[data-rcfg-range]")) {
    r.addEventListener("input", () => {
      const v = parseFloat(r.value);
      renderCfg[r.dataset.rcfgRange] = v;
      const bind = document.querySelector(`[data-bind="render-${r.dataset.rcfgRange}"]`);
      if (bind) bind.textContent = v.toFixed(2);
    });
  }
}
bindSmoothing();
bindRenderCfg();

// ---------- per-frame data bindings ----------
function setText(sel, txt) {
  const el = document.querySelector(sel);
  if (el && el.textContent !== txt) el.textContent = txt;
}
function setActive(nodeId, on) {
  nodeEls[nodeId].classList.toggle("active", !!on);
}

function tick() {
  // Tracker fps + cam thumb
  document.getElementById("fps-readout").textContent = trackerFps ? trackerFps.toFixed(1) : "—";

  if (hasVideo()) {
    // Camera thumb — straight from <video>, unmirrored so students can see the
    // *raw* input the model receives.
    camCtx.fillStyle = "#000";
    camCtx.fillRect(0, 0, camThumb.width, camThumb.height);
    const fit = videoFit(video, camThumb.width, camThumb.height);
    camCtx.drawImage(video, fit.dx, fit.dy, fit.dw, fit.dh);

    setText('[data-bind="cam-res"]',   `${video.videoWidth}×${video.videoHeight}`);
    setText('[data-bind="cam-ready"]', readyStateName(video.readyState));
    setText('[data-bind="cam-fps"]',   trackerFps ? `${trackerFps.toFixed(1)}` : "—");
  } else {
    setText('[data-bind="cam-res"]', "—");
    setText('[data-bind="cam-ready"]', video ? readyStateName(video.readyState) : "init");
    setText('[data-bind="cam-fps"]', "—");
  }

  // Face landmarker readouts
  setText('[data-bind="face-count"]', face ? "1" : "0");
  setText('[data-bind="face-nose"]',  face ? `${face.point(1).x.toFixed(2)}, ${face.point(1).y.toFixed(2)}` : "—");
  // Hand landmarker readouts
  setText('[data-bind="hand-count"]', String(hands.length));
  setText('[data-bind="hand-which"]', hands.length ? hands.map((h) => h.handedness[0]).join(",") : "—");

  // Face / hand signal port values
  if (face) {
    const s = face.signals;
    setText('[data-port-id="mouthOpen"][data-side="out"] .val',    s.mouthOpen.toFixed(2));
    setText('[data-port-id="smile"][data-side="out"] .val',        s.smile.toFixed(2));
    setText('[data-port-id="eyebrowRaise"][data-side="out"] .val', s.eyebrowRaise.toFixed(2));
    setText('[data-port-id="headTilt"][data-side="out"] .val',     s.headTilt.toFixed(2));
  }
  if (hands[0]) {
    const s = hands[0].signals;
    setText('[data-port-id="pinch"][data-side="out"] .val',       s.pinch.toFixed(2));
    setText('[data-port-id="openness"][data-side="out"] .val',    s.openness.toFixed(2));
    setText('[data-port-id="pointing"][data-side="out"] .val',    s.pointing ? "true" : "false");
    setText('[data-port-id="fingerCount"][data-side="out"] .val', String(s.fingerCount));
  }

  // Status pulses on node headers
  setActive("camera",  hasVideo());
  setActive("faceLm",  hasVideo() && !!face);
  setActive("handLm",  hasVideo() && hands.length > 0);
  setActive("faceSig", !!face);
  setActive("handSig", hands.length > 0);
  setActive("render",  hasVideo());

  // Edge active/idle
  for (const { edge: e, path, pulse } of edgeEls) {
    const on = !!e.active();
    path.classList.toggle("idle",  !on);
    pulse.classList.toggle("idle", !on);
  }

  requestAnimationFrame(tick);
}

function readyStateName(s) {
  return ["nothing", "metadata", "current", "future", "enough"][s] || "—";
}

// ---------- start ----------
// Re-layout when any node grows (e.g. preview canvases mount async).
const ro = new ResizeObserver(() => { drawEdges(); });
Object.values(nodeEls).forEach((el) => ro.observe(el));
window.addEventListener("resize", () => { layout(); });

requestAnimationFrame(layout);
// Second layout pass to absorb async-sized children (thumbnails).
setTimeout(layout, 250);

tracker.start();
tick();
