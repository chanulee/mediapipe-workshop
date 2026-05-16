import { Tracker } from "./lib/tracker.js";
import { NOSE_TIP, INDEX_TIP } from "./lib/landmarks.js";
import { mapRange, drawVideo, videoFit, toCanvas } from "./lib/utils.js";

const tracker = new Tracker({ face: true, hands: true });

let face = null;
let hands = [];
let video = null;

tracker.onUpdate((d) => {
  face = d.face;
  hands = d.hands;
  video = d.video;
});

function setup() {
  createCanvas(windowWidth, windowHeight);
  tracker.start();
  noStroke();
}

function draw() {
  background(10);
  drawVideo(video, drawingContext, width, height);

  // Landmarks are normalised against the video, not the canvas — map them
  // through the same cover-fit rectangle the video uses so dots stay locked
  // to the feed regardless of window shape.
  const fit = videoFit(video, width, height);

  // Yellow dot on the nose — size driven by how open the mouth is.
  if (face) {
    const nose = toCanvas(face.point(NOSE_TIP), fit);
    const size = mapRange(face.signals.mouthOpen, 0, 1, 40, 400);
    fill(220, 255, 0);
    circle(nose.x, nose.y, size);
  }

  // Pink dot on each index fingertip — size driven by hand openness.
  hands.forEach((h) => {
    const tip = toCanvas(h.point(INDEX_TIP), fit);
    const size = mapRange(h.signals.openness, 0, 1, 20, 200);
    fill(255, 60, 130);
    circle(tip.x, tip.y, size);
  });
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

window.setup = setup;
window.draw = draw;
window.windowResized = windowResized;
