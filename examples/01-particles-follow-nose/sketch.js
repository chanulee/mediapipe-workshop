import { Tracker } from "../../lib/tracker.js";
import { NOSE_TIP } from "../../lib/landmarks.js";
import { mapRange, drawVideo, videoFit, toCanvas } from "../../lib/utils.js";

const tracker = new Tracker({ face: true, hands: false });

let face = null;
let video = null;
const particles = [];

tracker.onUpdate((d) => { face = d.face; video = d.video; });

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
  // Draw the camera fresh each frame, then a translucent dark veil over it.
  // The veil dims the feed and also creates the particle motion-trail effect.
  drawVideo(video, drawingContext, width, height);
  noStroke();
  fill(10, 180);
  rect(0, 0, width, height);

  let target = null;
  if (face) {
    const fit = videoFit(video, width, height);
    target = toCanvas(face.point(NOSE_TIP), fit);
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
