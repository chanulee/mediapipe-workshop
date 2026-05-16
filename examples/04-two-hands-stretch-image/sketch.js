import { Tracker } from "../../lib/tracker.js";
import { INDEX_TIP } from "../../lib/landmarks.js";
import { dist, mapRange } from "../../lib/utils.js";

const tracker = new Tracker({ face: false, hands: true, maxHands: 2, smoothing: 0.6 });

let hands = [];
let img = null;

tracker.onUpdate((d) => { hands = d.hands; });

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

  if (hands.length < 2) {
    fill(160);
    textAlign(CENTER, CENTER);
    textSize(20);
    text("show both hands", width / 2, height / 2);
    return;
  }

  const a = hands[0].point(INDEX_TIP);
  const b = hands[1].point(INDEX_TIP);

  const cx = ((a.x + b.x) / 2) * width;
  const cy = ((a.y + b.y) / 2) * height;
  const d = dist(a, b); // normalised 0..~1.4

  const w = mapRange(d, 0.1, 1.2, 80, width * 0.9);
  const h = w * (img.height / img.width);

  // Rotate so the image lines up with the line between fingertips.
  const angle = Math.atan2((b.y - a.y) * height, (b.x - a.x) * width);

  push();
  translate(cx, cy);
  rotate(angle);
  image(img, 0, 0, w, h);
  pop();

  // Markers
  fill(255, 80, 120);
  circle(a.x * width, a.y * height, 18);
  circle(b.x * width, b.y * height, 18);
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
