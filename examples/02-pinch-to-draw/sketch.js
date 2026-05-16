import { Tracker } from "../../lib/tracker.js";
import { INDEX_TIP, THUMB_TIP } from "../../lib/landmarks.js";

const tracker = new Tracker({ face: false, hands: true, maxHands: 1, smoothing: 0.6 });

let hands = [];
let canvas; // off-screen layer we accumulate strokes into
let wasPinching = false;
let prevPoint = null;

tracker.onUpdate((d) => { hands = d.hands; });

function setup() {
  createCanvas(windowWidth, windowHeight);
  canvas = createGraphics(windowWidth, windowHeight);
  canvas.clear();
  tracker.start();
  noStroke();
}

function draw() {
  background(15);
  image(canvas, 0, 0);

  if (hands.length === 0) {
    wasPinching = false;
    prevPoint = null;
    return;
  }

  const h = hands[0];
  const pinch = h.signals.pinch;
  const isPinching = pinch > 0.75;

  // Midpoint between thumb and index — feels like the actual "pinch point".
  const thumb = h.point(THUMB_TIP);
  const index = h.point(INDEX_TIP);
  const px = ((thumb.x + index.x) / 2) * width;
  const py = ((thumb.y + index.y) / 2) * height;

  if (isPinching) {
    if (!wasPinching) prevPoint = { x: px, y: py };
    canvas.stroke(255, 240, 200);
    canvas.strokeWeight(4);
    canvas.line(prevPoint.x, prevPoint.y, px, py);
    prevPoint = { x: px, y: py };
  } else {
    prevPoint = null;
  }
  wasPinching = isPinching;

  // Cursor feedback
  fill(isPinching ? color(255, 80, 80) : color(80, 200, 255));
  circle(px, py, isPinching ? 20 : 12);
}

function keyPressed() {
  if (key === "c" || key === "C") canvas.clear();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  const old = canvas;
  canvas = createGraphics(windowWidth, windowHeight);
  canvas.image(old, 0, 0);
}

window.setup = setup;
window.draw = draw;
window.keyPressed = keyPressed;
window.windowResized = windowResized;
