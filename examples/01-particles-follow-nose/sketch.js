import { Tracker } from "../../lib/tracker.js";
import { NOSE_TIP } from "../../lib/landmarks.js";
import { mapRange } from "../../lib/utils.js";

const tracker = new Tracker({ face: true, hands: false });

let face = null;
const particles = [];

tracker.onUpdate((d) => { face = d.face; });

function setup() {
  createCanvas(windowWidth, windowHeight);
  tracker.start();
  noStroke();
  for (let i = 0; i < 300; i++) {
    particles.push({
      x: random(width),
      y: random(height),
      vx: 0,
      vy: 0,
    });
  }
}

function draw() {
  background(10, 30);

  let target = null;
  if (face) {
    const nose = face.point(NOSE_TIP);
    target = { x: nose.x * width, y: nose.y * height };
    fill(255, 200, 0);
    circle(target.x, target.y, 12);
  }

  fill(120, 200, 255);
  for (const p of particles) {
    if (target) {
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      // Pull strength tapers off with distance.
      const force = mapRange(distance, 0, 200, 1, 0);
      p.vx += (dx / (distance + 1)) * force;
      p.vy += (dy / (distance + 1)) * force;
    }
    p.vx *= 0.9;
    p.vy *= 0.9;
    p.x += p.vx;
    p.y += p.vy;
    circle(p.x, p.y, 4);
  }
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); }

window.setup = setup;
window.draw = draw;
window.windowResized = windowResized;
