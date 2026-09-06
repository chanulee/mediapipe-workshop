import { mapRange, dist } from "../../lib/utils.js";
import GUI from "lil-gui";

// Outline morph using REAL font SVG paths (opentype.js), not p5 textToPoints.
//
// Why the old version cracked:
//   textToPoints() samples the glyph into a polyline. Reconnecting those
//   samples with Catmull-Rom (curveVertex) invents new curves that don't
//   match the original cubic beziers — spikes and gaps at joins.
// Fix:
//   font.getPath() → M / L / Q / C / Z commands, drawn with bezierCurveTo.

const FONT_URL =
  "https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-Regular.ttf";

const config = {
  bgColor: "#09090b",
  textColor: "#ffffff",
  glowColor: "rgba(0, 243, 255, 0.45)",

  fontSize1: 120,
  fontSize2: 60,

  morphRadius: 180,
  morphStrength: 80,
  morphNoise: 12,
  morphSpring: 0.15,
  morphDamping: 0.82,
  morphWeightNormal: 1.5,
  morphWeightHover: 4.0,

  showCursor: true,
};

let otFont = null;
let line1 = null; // { cmds, points }
let line2 = null;

class MorphPoint {
  constructor(x, y) {
    this.homeX = x;
    this.homeY = y;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
  }
}

// Build a drawable path from opentype Path commands.
// Each on-curve / control point becomes a MorphPoint we can displace.
function buildLine(text, fontSize, yOffset) {
  // Measure with opentype so we can center like SVG text.
  const advance = otFont.getAdvanceWidth(text, fontSize);
  const x = (width - advance) / 2;
  // Baseline: center block roughly on canvas mid, then apply yOffset.
  const y = height / 2 + yOffset;

  const path = otFont.getPath(text, x, y, fontSize);
  const cmds = [];
  const points = [];

  for (const c of path.commands) {
    if (c.type === "M") {
      const p = new MorphPoint(c.x, c.y);
      points.push(p);
      cmds.push({ type: "M", p });
    } else if (c.type === "L") {
      const p = new MorphPoint(c.x, c.y);
      points.push(p);
      cmds.push({ type: "L", p });
    } else if (c.type === "Q") {
      const cp = new MorphPoint(c.x1, c.y1);
      const p = new MorphPoint(c.x, c.y);
      points.push(cp, p);
      cmds.push({ type: "Q", cp, p });
    } else if (c.type === "C") {
      const cp1 = new MorphPoint(c.x1, c.y1);
      const cp2 = new MorphPoint(c.x2, c.y2);
      const p = new MorphPoint(c.x, c.y);
      points.push(cp1, cp2, p);
      cmds.push({ type: "C", cp1, cp2, p });
    } else if (c.type === "Z") {
      cmds.push({ type: "Z" });
    }
  }

  return { cmds, points };
}

function rebuildPaths() {
  if (!otFont || !width) return;
  line1 = buildLine("Open Call", config.fontSize1, -20);
  line2 = buildLine("creative motion study", config.fontSize2, 70);
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  cursor("none");
  buildGui();

  opentype.load(FONT_URL, (err, font) => {
    if (err) {
      console.error("Font load failed", err);
      return;
    }
    otFont = font;
    rebuildPaths();
  });
}

function draw() {
  background(config.bgColor);

  const cx = mouseX;
  const cy = mouseY;

  if (line1 && line2) {
    updatePoints(line1.points, cx, cy);
    updatePoints(line2.points, cx, cy);
    drawPath(line1, cx, cy);
    drawPath(line2, cx, cy);
  } else {
    push();
    fill(120);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(14);
    text("loading font…", width / 2, height / 2);
    pop();
  }

  if (config.showCursor) {
    push();
    noFill();
    stroke(0, 243, 255, 150);
    strokeWeight(1.5);
    circle(cx, cy, 22);
    fill(0, 243, 255, 200);
    noStroke();
    circle(cx, cy, 5);
    pop();
  }
}

function updatePoints(points, cx, cy) {
  for (const p of points) {
    const d = dist({ x: cx, y: cy }, { x: p.homeX, y: p.homeY });
    let targetX = p.homeX;
    let targetY = p.homeY;

    if (d < config.morphRadius) {
      const angle = Math.atan2(p.homeY - cy, p.homeX - cx);
      const force = mapRange(d, 0, config.morphRadius, config.morphStrength, 0);
      targetX += Math.cos(angle) * force;
      targetY += Math.sin(angle) * force;

      const w =
        Math.sin(frameCount * 0.08 + p.homeX * 0.04) *
        config.morphNoise *
        (1 - d / config.morphRadius);
      targetX += Math.cos(angle + Math.PI / 2) * w;
      targetY += Math.sin(angle + Math.PI / 2) * w;
    }

    const ax = (targetX - p.x) * config.morphSpring;
    const ay = (targetY - p.y) * config.morphSpring;
    p.vx = (p.vx + ax) * config.morphDamping;
    p.vy = (p.vy + ay) * config.morphDamping;
    p.x += p.vx;
    p.y += p.vy;
  }
}

function drawPath(line, cx, cy) {
  let minD = Infinity;
  let hueAnchor = 0;
  for (const p of line.points) {
    const d = dist({ x: cx, y: cy }, { x: p.x, y: p.y });
    if (d < minD) {
      minD = d;
      hueAnchor = p.homeX;
    }
  }

  const hot = minD < config.morphRadius;
  const t = hot ? mapRange(minD, 0, config.morphRadius, 1, 0) : 0;
  const weight = lerp(config.morphWeightNormal, config.morphWeightHover, t);

  const ctx = drawingContext;
  ctx.save();
  ctx.shadowBlur = 10;
  ctx.shadowColor = config.glowColor;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = weight;
  ctx.strokeStyle = hot
    ? `hsl(${(frameCount * 2.5 + hueAnchor * 0.4) % 360}, 100%, 60%)`
    : config.textColor;
  ctx.fillStyle = "transparent";

  // Replay the font's own SVG path commands — continuous cubic/quad beziers.
  ctx.beginPath();
  for (const c of line.cmds) {
    if (c.type === "M") ctx.moveTo(c.p.x, c.p.y);
    else if (c.type === "L") ctx.lineTo(c.p.x, c.p.y);
    else if (c.type === "Q") ctx.quadraticCurveTo(c.cp.x, c.cp.y, c.p.x, c.p.y);
    else if (c.type === "C")
      ctx.bezierCurveTo(c.cp1.x, c.cp1.y, c.cp2.x, c.cp2.y, c.p.x, c.p.y);
    else if (c.type === "Z") ctx.closePath();
  }
  ctx.stroke();
  ctx.restore();
}

function buildGui() {
  const gui = new GUI({ title: "Outline Hover", width: 280 });

  const fStyle = gui.addFolder("Style");
  fStyle.addColor(config, "bgColor").name("Background");
  fStyle.addColor(config, "textColor").name("Text Color");
  fStyle.addColor(config, "glowColor").name("Glow");
  fStyle.add(config, "showCursor").name("Show Cursor");
  fStyle.add(config, "fontSize1", 40, 200, 2).name("Title Size").onFinishChange(rebuildPaths);
  fStyle.add(config, "fontSize2", 20, 120, 2).name("Subtitle Size").onFinishChange(rebuildPaths);

  const fMorph = gui.addFolder("Morph");
  fMorph.add(config, "morphRadius", 50, 400, 10).name("Hover Radius");
  fMorph.add(config, "morphStrength", 10, 200, 5).name("Displace Power");
  fMorph.add(config, "morphNoise", 0, 50, 1).name("Noise Wave");
  fMorph.add(config, "morphSpring", 0.05, 0.5, 0.01).name("Spring Speed");
  fMorph.add(config, "morphDamping", 0.5, 0.99, 0.01).name("Damping");
  fMorph.add(config, "morphWeightNormal", 0.5, 5, 0.1).name("Line W (Normal)");
  fMorph.add(config, "morphWeightHover", 1.0, 10, 0.1).name("Line W (Hover)");
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  rebuildPaths();
}

window.setup = setup;
window.draw = draw;
window.windowResized = windowResized;
