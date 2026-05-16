import { Tracker } from "../../lib/tracker.js";
import {
  NOSE_TIP, FOREHEAD, CHIN, LEFT_CHEEK, RIGHT_CHEEK,
  LEFT_EYE, RIGHT_EYE, UPPER_LIP, LOWER_LIP,
  WRIST, THUMB_TIP, INDEX_TIP, MIDDLE_KNUCKLE,
  FACE_NAMED, HAND_NAMED,
} from "../../lib/landmarks.js";
import { dist, mapRange, drawVideo, videoFit, toCanvas } from "../../lib/utils.js";
import GUI from "lil-gui";

// Inverse lookups for label rendering: index → human name.
const FACE_NAME_BY_INDEX = invert(FACE_NAMED);
const HAND_NAME_BY_INDEX = invert(HAND_NAMED);

function invert(o) {
  const m = {};
  for (const [k, v] of Object.entries(o)) m[v] = k;
  return m;
}

// ---------- Config ----------
const config = {
  // camera
  showCamera: true,
  cameraOpacity: 1.0,
  mirror: true,
  bgColor: "#0a0a0a",

  // landmark overlay
  landmarkMode: "named",       // "all" | "named" | "off"
  labelMode: "both",            // "none" | "index" | "name" | "both"
  textSize: 11,
  dotSize: 4,
  showFaceBox: false,
  showHandBox: false,

  // main dots
  showFaceDot: true,
  showHandDots: true,
  faceColor: "#c8ff00",
  handColor: "#ff3c6e",
  noseMin: 40,
  noseMax: 400,
  handMin: 20,
  handMax: 200,

  // tracker
  smoothing: 0.5,
  paused: false,

  // ---- live readouts (face) ----
  _mouthOpen: 0,
  _smile: 0,
  _eyebrowRaise: 0,
  _headTilt: 0,
  _faceWidthPx: 0,
  _faceHeightPx: 0,
  _mouthGapPx: 0,
  _eyeDistancePx: 0,
  _noseScreenX: 0,
  _noseScreenY: 0,

  // ---- live readouts (hand 0) ----
  _h0_present: "no",
  _h0_handedness: "—",
  _h0_pinch: 0,
  _h0_openness: 0,
  _h0_pointing: "false",
  _h0_fingerCount: 0,
  _h0_thumbIndexPx: 0,
  _h0_handSizePx: 0,

  // ---- live readouts (hand 1) ----
  _h1_present: "no",
  _h1_handedness: "—",
  _h1_pinch: 0,
  _h1_openness: 0,
  _h1_fingerCount: 0,

  // actions
  snapshot: () => saveCanvas("snapshot", "png"),
  pauseResume: () => { config.paused = !config.paused; },
};

const tracker = new Tracker({ face: true, hands: true, maxHands: 2, smoothing: config.smoothing });

let face = null;
let hands = [];
let video = null;
let frozen = null; // last frame data captured when pausing

tracker.onUpdate((d) => {
  if (config.paused) return;
  face = d.face;
  hands = d.hands;
  video = d.video;
});

// ---------- p5 ----------
function setup() {
  createCanvas(windowWidth, windowHeight);
  tracker.start();
  noStroke();
  buildGui();
}

function draw() {
  background(color(config.bgColor));

  // Camera
  if (config.showCamera) {
    drawVideo(video, drawingContext, width, height, {
      mirror: config.mirror,
      opacity: config.cameraOpacity,
    });
  }

  const fit = videoFit(video, width, height);

  // Sync runtime config into tracker
  tracker.opts.smoothing = config.smoothing;

  // Landmark overlay
  if (config.landmarkMode !== "off") {
    drawLandmarkOverlay(fit);
  }

  // BBoxes
  if (config.showFaceBox && face) drawBBox(face.bbox, fit, color(0, 255, 100, 180));
  if (config.showHandBox)         hands.forEach(h => drawBBox(h.bbox, fit, color(255, 60, 110, 200)));

  // Big dots
  if (config.showFaceDot && face) {
    const nose = toCanvas(face.point(NOSE_TIP), fit);
    const size = mapRange(face.signals.mouthOpen, 0, 1, config.noseMin, config.noseMax);
    fill(config.faceColor);
    noStroke();
    circle(nose.x, nose.y, size);
  }
  if (config.showHandDots) {
    fill(config.handColor);
    noStroke();
    hands.forEach((h) => {
      const tip = toCanvas(h.point(INDEX_TIP), fit);
      const size = mapRange(h.signals.openness, 0, 1, config.handMin, config.handMax);
      circle(tip.x, tip.y, size);
    });
  }

  updateReadouts(fit);
}

// ---------- Landmark overlay ----------
function drawLandmarkOverlay(fit) {
  push();
  noStroke();
  textSize(config.textSize);

  if (face && face.raw) {
    fill(0, 255, 100, 220);
    drawPoints(face.raw, fit, config.dotSize, "face");
  }
  hands.forEach((h) => {
    if (!h.raw) return;
    fill(255, 60, 110, 240);
    drawPoints(h.raw, fit, config.dotSize + 2, "hand");
  });
  pop();
}

function drawPoints(raw, fit, dotSize, kind) {
  const nameMap = kind === "face" ? FACE_NAME_BY_INDEX : HAND_NAME_BY_INDEX;
  const named = kind === "face" ? FACE_NAMED : HAND_NAMED;
  const filterToNamed = config.landmarkMode === "named";
  const indices = filterToNamed ? Object.values(named) : raw.map((_, i) => i);

  for (const i of indices) {
    const p = raw[i];
    if (!p) continue;
    const x = fit.dx + p.x * fit.dw;
    const y = fit.dy + p.y * fit.dh;
    circle(x, y, dotSize);

    if (config.labelMode === "none") continue;
    const name = nameMap[i];
    let label = "";
    if (config.labelMode === "index") label = String(i);
    else if (config.labelMode === "name") label = name || "";
    else { // both
      label = name ? `${name} (${i})` : String(i);
    }
    if (label) {
      // Subtle outline for readability over the camera feed
      fill(0, 200);
      text(label, x + dotSize + 2 + 1, y + 1);
      fill(255, 240);
      text(label, x + dotSize + 2, y);
      // Restore the point colour for the next iteration's dot
      if (kind === "face") fill(0, 255, 100, 220);
      else fill(255, 60, 110, 240);
    }
  }
}

function drawBBox(bb, fit, col) {
  if (!bb) return;
  push();
  noFill();
  stroke(col);
  strokeWeight(1.5);
  rect(fit.dx + bb.x * fit.dw, fit.dy + bb.y * fit.dh, bb.w * fit.dw, bb.h * fit.dh);
  pop();
}

// ---------- Readouts ----------
function updateReadouts(fit) {
  if (face) {
    const s = face.signals;
    config._mouthOpen    = round2(s.mouthOpen);
    config._smile        = round2(s.smile);
    config._eyebrowRaise = round2(s.eyebrowRaise);
    config._headTilt     = round2(s.headTilt);
    const cheekL = toCanvas(face.point(LEFT_CHEEK),  fit);
    const cheekR = toCanvas(face.point(RIGHT_CHEEK), fit);
    const fore   = toCanvas(face.point(FOREHEAD),    fit);
    const chin   = toCanvas(face.point(CHIN),        fit);
    const upper  = toCanvas(face.point(UPPER_LIP),   fit);
    const lower  = toCanvas(face.point(LOWER_LIP),   fit);
    const eyeL   = toCanvas(face.point(LEFT_EYE),    fit);
    const eyeR   = toCanvas(face.point(RIGHT_EYE),   fit);
    const nose   = toCanvas(face.point(NOSE_TIP),    fit);
    config._faceWidthPx   = Math.round(dist(cheekL, cheekR));
    config._faceHeightPx  = Math.round(dist(fore, chin));
    config._mouthGapPx    = Math.round(dist(upper, lower));
    config._eyeDistancePx = Math.round(dist(eyeL, eyeR));
    config._noseScreenX   = Math.round(nose.x);
    config._noseScreenY   = Math.round(nose.y);
  }
  writeHandReadout(hands[0], 0, fit);
  writeHandReadout(hands[1], 1, fit);
}

function writeHandReadout(h, i, fit) {
  const p = `_h${i}_`;
  if (!h) {
    config[p + "present"] = "no";
    config[p + "handedness"] = "—";
    config[p + "pinch"] = 0;
    config[p + "openness"] = 0;
    if (i === 0) config[p + "pointing"] = "false";
    config[p + "fingerCount"] = 0;
    if (i === 0) { config[p + "thumbIndexPx"] = 0; config[p + "handSizePx"] = 0; }
    return;
  }
  const s = h.signals;
  config[p + "present"] = "yes";
  config[p + "handedness"] = h.handedness;
  config[p + "pinch"] = round2(s.pinch);
  config[p + "openness"] = round2(s.openness);
  config[p + "fingerCount"] = s.fingerCount;
  if (i === 0) {
    config[p + "pointing"] = s.pointing ? "true" : "false";
    const thumb = toCanvas(h.point(THUMB_TIP), fit);
    const idx   = toCanvas(h.point(INDEX_TIP), fit);
    const wrist = toCanvas(h.point(WRIST), fit);
    const knuck = toCanvas(h.point(MIDDLE_KNUCKLE), fit);
    config[p + "thumbIndexPx"] = Math.round(dist(thumb, idx));
    config[p + "handSizePx"]   = Math.round(dist(wrist, knuck));
  }
}

// ---------- GUI ----------
function buildGui() {
  const gui = new GUI({ title: "controls", width: 320 });

  const fLM = gui.addFolder("landmarks");
  fLM.add(config, "landmarkMode", ["all", "named", "off"]).name("show points");
  fLM.add(config, "labelMode", ["none", "index", "name", "both"]).name("label");
  fLM.add(config, "textSize", 6, 32, 1).name("text size");
  fLM.add(config, "dotSize", 1, 12, 0.5).name("dot size");
  fLM.add(config, "showFaceBox").name("face bbox");
  fLM.add(config, "showHandBox").name("hand bbox");

  const fCam = gui.addFolder("camera");
  fCam.add(config, "showCamera").name("show feed");
  fCam.add(config, "cameraOpacity", 0, 1, 0.01).name("opacity");
  fCam.add(config, "mirror").name("mirror");
  fCam.addColor(config, "bgColor").name("background");

  const fDots = gui.addFolder("big dots (size from signals)");
  fDots.add(config, "showFaceDot").name("face → mouthOpen");
  fDots.addColor(config, "faceColor").name("face colour");
  fDots.add(config, "noseMin", 0, 200, 1).name("min size");
  fDots.add(config, "noseMax", 40, 800, 1).name("max size");
  fDots.add(config, "showHandDots").name("hand → openness");
  fDots.addColor(config, "handColor").name("hand colour");
  fDots.add(config, "handMin", 0, 100, 1).name("min size");
  fDots.add(config, "handMax", 20, 400, 1).name("max size");
  fDots.close();

  const fTrk = gui.addFolder("tracker");
  fTrk.add(config, "smoothing", 0, 0.95, 0.01).name("smoothing");
  fTrk.add(config, "paused").name("pause");
  fTrk.add(config, "snapshot").name("save snapshot (png)");

  const fFace = gui.addFolder("face — signals (0..1)");
  fFace.add(config, "_mouthOpen").name("mouthOpen").listen().disable();
  fFace.add(config, "_smile").name("smile").listen().disable();
  fFace.add(config, "_eyebrowRaise").name("eyebrowRaise").listen().disable();
  fFace.add(config, "_headTilt").name("headTilt (-1..1)").listen().disable();

  const fFaceM = gui.addFolder("face — measurements (px)");
  fFaceM.add(config, "_faceWidthPx").name("face width").listen().disable();
  fFaceM.add(config, "_faceHeightPx").name("face height").listen().disable();
  fFaceM.add(config, "_mouthGapPx").name("mouth gap").listen().disable();
  fFaceM.add(config, "_eyeDistancePx").name("eye distance").listen().disable();
  fFaceM.add(config, "_noseScreenX").name("nose x").listen().disable();
  fFaceM.add(config, "_noseScreenY").name("nose y").listen().disable();
  fFaceM.close();

  const fH0 = gui.addFolder("hand[0]");
  fH0.add(config, "_h0_present").name("present").listen().disable();
  fH0.add(config, "_h0_handedness").name("handedness").listen().disable();
  fH0.add(config, "_h0_pinch").name("pinch").listen().disable();
  fH0.add(config, "_h0_openness").name("openness").listen().disable();
  fH0.add(config, "_h0_pointing").name("pointing").listen().disable();
  fH0.add(config, "_h0_fingerCount").name("fingerCount").listen().disable();
  fH0.add(config, "_h0_thumbIndexPx").name("thumb↔index (px)").listen().disable();
  fH0.add(config, "_h0_handSizePx").name("hand size (px)").listen().disable();
  fH0.close();

  const fH1 = gui.addFolder("hand[1]");
  fH1.add(config, "_h1_present").name("present").listen().disable();
  fH1.add(config, "_h1_handedness").name("handedness").listen().disable();
  fH1.add(config, "_h1_pinch").name("pinch").listen().disable();
  fH1.add(config, "_h1_openness").name("openness").listen().disable();
  fH1.add(config, "_h1_fingerCount").name("fingerCount").listen().disable();
  fH1.close();
}

function round2(v) { return Math.round(v * 100) / 100; }

function windowResized() { resizeCanvas(windowWidth, windowHeight); }

window.setup = setup;
window.draw = draw;
window.windowResized = windowResized;
