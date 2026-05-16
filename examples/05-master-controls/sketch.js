import { Tracker } from "../../lib/tracker.js";
import { NOSE_TIP, INDEX_TIP } from "../../lib/landmarks.js";
import { mapRange, debugDraw } from "../../lib/utils.js";
import GUI from "lil-gui";

// ---------- Config (live-editable via GUI) ----------
const config = {
  // camera
  showCamera: true,
  cameraOpacity: 1.0,
  mirror: true,
  // overlays
  showFaceDot: true,
  showHandDots: true,
  showAllPoints: false,
  showFaceLabels: false,
  showHandLabels: true,
  // colours (lil-gui returns "#rrggbb")
  faceColor: "#c8ff00",
  handColor: "#ff3c6e",
  bgColor: "#0a0a0a",
  // sizing
  noseMin: 40,
  noseMax: 400,
  handMin: 15,
  handMax: 120,
  // tracker
  smoothing: 0.5,
  // signals readout
  _mouthOpen: 0,
  _smile: 0,
  _pinch: 0,
  _openness: 0,
  _fingerCount: 0,
};

const tracker = new Tracker({
  face: true,
  hands: true,
  maxHands: 2,
  smoothing: config.smoothing,
  flip: true,
});

let face = null;
let hands = [];
let video = null;

tracker.onUpdate((d) => {
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
  const bg = color(config.bgColor);
  background(bg);

  // Camera feed
  if (config.showCamera && video && video.readyState >= 2) {
    push();
    if (config.mirror) {
      translate(width, 0);
      scale(-1, 1);
    }
    const { dw, dh, dx, dy } = coverFit(video.videoWidth, video.videoHeight, width, height);
    tint(255, 255 * config.cameraOpacity);
    image(video, dx, dy, dw, dh);
    noTint();
    pop();
  }

  // Push live signal values into the GUI readout
  if (face) {
    config._mouthOpen = round2(face.signals.mouthOpen);
    config._smile = round2(face.signals.smile);
  }
  if (hands[0]) {
    config._pinch = round2(hands[0].signals.pinch);
    config._openness = round2(hands[0].signals.openness);
    config._fingerCount = hands[0].signals.fingerCount;
  }

  // Face dot — sized by mouthOpen
  if (config.showFaceDot && face) {
    const nose = face.point(NOSE_TIP);
    const size = mapRange(face.signals.mouthOpen, 0, 0.6, config.noseMin, config.noseMax);
    fill(config.faceColor);
    circle(nose.x * width, nose.y * height, size);
  }

  // Hand dots — sized by hand openness (closed fist = small, open hand = large)
  if (config.showHandDots) {
    fill(config.handColor);
    hands.forEach((h) => {
      const tip = h.point(INDEX_TIP);
      const size = mapRange(h.signals.openness, 0, 1, config.handMin, config.handMax);
      circle(tip.x * width, tip.y * height, size);
    });
  }

  // All landmarks debug overlay
  if (config.showAllPoints) {
    debugDraw(face, hands, {
      showFaceLabels: config.showFaceLabels,
      showHandLabels: config.showHandLabels,
    });
  }
}

// ---------- GUI ----------
function buildGui() {
  const gui = new GUI({ title: "controls" });

  const fCam = gui.addFolder("camera");
  fCam.add(config, "showCamera").name("show feed");
  fCam.add(config, "cameraOpacity", 0, 1, 0.01).name("opacity");
  fCam.add(config, "mirror").name("mirror");

  const fOverlay = gui.addFolder("overlays");
  fOverlay.add(config, "showFaceDot").name("face dot");
  fOverlay.add(config, "showHandDots").name("hand dots");
  fOverlay.add(config, "showAllPoints").name("all landmarks");
  fOverlay.add(config, "showFaceLabels").name("face labels");
  fOverlay.add(config, "showHandLabels").name("hand labels");

  const fColor = gui.addFolder("colors");
  fColor.addColor(config, "bgColor").name("background");
  fColor.addColor(config, "faceColor").name("face dot");
  fColor.addColor(config, "handColor").name("hand dot");

  const fSize = gui.addFolder("sizes");
  fSize.add(config, "noseMin", 0, 200, 1).name("nose min");
  fSize.add(config, "noseMax", 40, 800, 1).name("nose max");
  fSize.add(config, "handMin", 0, 100, 1).name("hand min");
  fSize.add(config, "handMax", 20, 400, 1).name("hand max");

  const fSignals = gui.addFolder("live signals");
  fSignals.add(config, "_mouthOpen").name("mouthOpen").listen().disable();
  fSignals.add(config, "_smile").name("smile").listen().disable();
  fSignals.add(config, "_pinch").name("pinch[0]").listen().disable();
  fSignals.add(config, "_openness").name("openness[0]").listen().disable();
  fSignals.add(config, "_fingerCount").name("fingers[0]").listen().disable();
  fSignals.close();
}

// ---------- helpers ----------
function coverFit(srcW, srcH, dstW, dstH) {
  if (!srcW || !srcH) return { dw: dstW, dh: dstH, dx: 0, dy: 0 };
  const srcRatio = srcW / srcH;
  const dstRatio = dstW / dstH;
  let dw, dh;
  if (srcRatio > dstRatio) {
    dh = dstH;
    dw = dh * srcRatio;
  } else {
    dw = dstW;
    dh = dw / srcRatio;
  }
  return { dw, dh, dx: (dstW - dw) / 2, dy: (dstH - dh) / 2 };
}

function round2(v) { return Math.round(v * 100) / 100; }

function windowResized() { resizeCanvas(windowWidth, windowHeight); }

window.setup = setup;
window.draw = draw;
window.windowResized = windowResized;
