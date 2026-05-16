import { Tracker } from "../../lib/tracker.js";
import { INDEX_TIP } from "../../lib/landmarks.js";
import { dist, mapRange, drawVideo, videoFit, toCanvas } from "../../lib/utils.js";

const tracker = new Tracker({ face: false, hands: true, maxHands: 2, smoothing: 0.6 });

let hands = [];
let video = null;
let img = null;

tracker.onUpdate((d) => { hands = d.hands; video = d.video; });

function setup() {
  createCanvas(windowWidth, windowHeight);
  tracker.start();
  // A small inline placeholder texture — replace with loadImage() of your own.
  img = makeStripes(400, 400);
  imageMode(CENTER);
  noStroke();
}

function draw() {
  background(15);
  drawVideo(video, drawingContext, width, height, { opacity: 0.6 });

  if (hands.length < 2) {
    fill(160);
    textAlign(CENTER, CENTER);
    textSize(20);
    text("show both hands", width / 2, height / 2);
    return;
  }

  const fit = videoFit(video, width, height);
  const aN = hands[0].point(INDEX_TIP);
  const bN = hands[1].point(INDEX_TIP);
  const a = toCanvas(aN, fit);
  const b = toCanvas(bN, fit);

  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2;
  const d = dist(aN, bN); // normalised 0..~1.4

  const w = mapRange(d, 0.1, 1.2, 80, width * 0.9);
  const h = w * (img.height / img.width);

  // Rotate so the image lines up with the line between fingertips.
  const angle = Math.atan2(b.y - a.y, b.x - a.x);

  push();
  translate(cx, cy);
  rotate(angle);
  image(img, 0, 0, w, h);
  pop();

  // Markers
  fill(255, 80, 120);
  circle(a.x, a.y, 18);
  circle(b.x, b.y, 18);
}

function makeStripes(w, h) {
  const g = createGraphics(w, h);
  g.noStroke();
  for (let i = 0; i < 20; i++) {
    g.fill((i * 17) % 255, 200, 255 - i * 10);
    g.rect((i / 20) * w, 0, w / 20, h);
  }
  return g;
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); }

window.setup = setup;
window.draw = draw;
window.windowResized = windowResized;
