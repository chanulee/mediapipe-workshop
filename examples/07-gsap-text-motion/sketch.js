import { Tracker } from "../../lib/tracker.js";
import { INDEX_TIP, THUMB_TIP, WRIST } from "../../lib/landmarks.js";
import { mapRange, drawVideo, videoFit, toCanvas, dist } from "../../lib/utils.js";
import GUI from "lil-gui";

// ---------- Config & Settings ----------
const config = {
  // mode
  mode: 1, // 1 = Glyph Morph, 2 = Particle Gravity, 3 = Staggered Trail
  
  // camera
  showCamera: true,
  cameraOpacity: 0.15,
  mirror: true,
  bgColor: "#09090b",
  showHandSkeleton: true,
  skeletonOpacity: 0.3,
  
  // text options
  fontSize1: 120,
  fontSize2: 60,
  textColor: "#ffffff",
  glowColor: "rgba(0, 243, 255, 0.4)",
  
  // Mode 1: Morph
  morphRadius: 180,
  morphStrength: 100,
  morphNoise: 15,
  morphSpring: 0.15,
  morphDamping: 0.82,
  morphWeightNormal: 1.5,
  morphWeightHover: 4.0,
  glyphStyle: "bezier", // "lines" | "points" | "bezier"
  
  // Mode 2: Gravity Particles
  particleSize: 3.5,
  gravityG: 12,
  orbitStrength: 4.5,
  pinchMultiplier: 3.0,
  particleDamping: 0.90,
  particleReturnForce: 0.25,
  
  // Mode 3: Staggered Trail
  trailDelay: 0.02,
  letterSpacing: 25,
  waveAmplitude: 12,
  trailDuration: 0.5,
  trailEase: "power2.out",
  trailSpeed: 0.15, // lerp factor
  
  // tracker
  smoothing: 0.4,
};

// Global variables
let tracker = null;
let hands = [];
let video = null;
let myFont = null;
let primaryHandedness = null;

// Mode 1: Morph Points
let morphContours1 = [];
let morphContours2 = [];

// Mode 2: Gravity Particles
let particles = [];

// Mode 3: Staggered Trail Letters
let trailLetters = [];
let trailHistory = [];
const textString = "Open Call creative motion study";

// Preload Google Font
function preload() {
  // Roboto Regular
  myFont = loadFont("https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-Regular.ttf");
}

// Helper class for morphing vertices
class MorphPoint {
  constructor(pt) {
    this.homeX = pt.x;
    this.homeY = pt.y;
    this.x = pt.x;
    this.y = pt.y;
    this.vx = 0;
    this.vy = 0;
  }
}

// Segment raw points into closed contours based on distance jumps
function segmentPoints(pts, maxDist = 25) {
  let contours = [];
  let current = [];
  for (let i = 0; i < pts.length; i++) {
    if (current.length === 0) {
      current.push(pts[i]);
    } else {
      let prev = pts[i - 1];
      let d = dist({ x: pts[i].x, y: pts[i].y }, { x: prev.x, y: prev.y });
      if (d > maxDist) {
        contours.push(current);
        current = [pts[i]];
      } else {
        current.push(pts[i]);
      }
    }
  }
  if (current.length > 0) {
    contours.push(current);
  }
  return contours;
}

// Generate contour nodes for a given line of text
function getTextContours(txt, fontSize, yOffset) {
  let bounds = myFont.textBounds(txt, 0, 0, fontSize);
  let x = (width - bounds.w) / 2 - bounds.x;
  let y = (height - bounds.h) / 2 + yOffset;
  let rawPts = myFont.textToPoints(txt, x, y, fontSize, { sampleFactor: 0.15 });
  
  let rawContours = segmentPoints(rawPts, 25);
  let contours = [];
  for (let rc of rawContours) {
    let c = rc.map(pt => new MorphPoint(pt));
    contours.push(c);
  }
  return contours;
}

// Generate flat particles for Mode 2
function getTextParticles(txt, fontSize, yOffset) {
  let bounds = myFont.textBounds(txt, 0, 0, fontSize);
  let x = (width - bounds.w) / 2 - bounds.x;
  let y = (height - bounds.h) / 2 + yOffset;
  let rawPts = myFont.textToPoints(txt, x, y, fontSize, { sampleFactor: 0.12 });
  
  return rawPts.map(pt => ({
    homeX: pt.x,
    homeY: pt.y,
    x: pt.x + random(-10, 10),
    y: pt.y + random(-10, 10),
    vx: 0,
    vy: 0,
    speedLimit: 18,
  }));
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  
  // Start Tracker with face detection disabled and hand detection enabled for 2 hands
  tracker = new Tracker({ face: false, hands: true, maxHands: 2, smoothing: config.smoothing });
  tracker.onUpdate((d) => {
    hands = d.hands;
    video = d.video;
  });
  tracker.start();
  
  // 1. Mode 1 Initialize (Morph text)
  morphContours1 = getTextContours("Open Call", config.fontSize1, -40);
  morphContours2 = getTextContours("creative motion study", config.fontSize2, 60);
  
  // 2. Mode 2 Initialize (Particles)
  const pts1 = getTextParticles("Open Call", config.fontSize1, -40);
  const pts2 = getTextParticles("creative motion study", config.fontSize2, 60);
  particles = [...pts1, ...pts2];
  
  // 3. Mode 3 Initialize (Stagger Trail Letters)
  const words = textString.split("");
  trailLetters = words.map((char, i) => ({
    char: char,
    x: width / 2,
    y: height / 2,
    targetX: width / 2,
    targetY: height / 2,
    scale: 1.0,
    rotation: 0,
    colorHue: (i * 12) % 360,
  }));
  
  buildGui();
  
  // Listen for key presses to switch modes manually
  window.keyPressed = () => {
    if (key === "1") config.mode = 1;
    if (key === "2") config.mode = 2;
    if (key === "3") config.mode = 3;
  };
}

let prevCx = 0;
let prevCy = 0;

function draw() {
  background(config.bgColor);
  
  // Sync smoothing
  if (tracker) tracker.opts.smoothing = config.smoothing;
  
  // 1. Draw webcam feed in the background with opacity
  if (config.showCamera && video) {
    drawVideo(video, drawingContext, width, height, {
      mirror: config.mirror,
      opacity: config.cameraOpacity,
    });
  }
  
  const fit = videoFit(video, width, height);

  // Draw hand skeletons
  if (config.showHandSkeleton) {
    for (let h of hands) {
      drawHandSkeleton(h, fit);
    }
  }

  // 2. Determine hands mapping
  // The first hand to enter the screen stays the interaction pointer.
  // A second hand becomes the mode-switch controller.
  let activeHand = null;
  let modeHand = null;
  
  if (hands.length === 0) {
    primaryHandedness = null;
  } else if (hands.length === 1) {
    activeHand = hands[0];
    primaryHandedness = activeHand.handedness;
  } else {
    for (let h of hands) {
      if (h.handedness === primaryHandedness) {
        activeHand = h;
      } else {
        modeHand = h;
      }
    }
    if (!activeHand || !modeHand) {
      activeHand = hands[0];
      modeHand = hands[1];
      primaryHandedness = activeHand.handedness;
    }
  }
  
  // Handle Gesture-based Mode Switch using the new hand
  let modeHandAngle = 0;
  // Handle Tilt-based Mode Switch using the second hand
  if (modeHand) {
    let wristPt = modeHand.point(WRIST);
    let middlePt = modeHand.point(9); // MIDDLE_KNUCKLE
    if (wristPt && middlePt) {
      let dx = middlePt.x - wristPt.x;
      let dy = middlePt.y - wristPt.y;
      let rad = atan2(dy, dx);
      modeHandAngle = degrees(rad); // -180 to 180
      
      // Determine mode based on tilt angles
      if (modeHandAngle < -125 || modeHandAngle > 150) {
        if (config.mode !== 2) config.mode = 2;
      } else if (modeHandAngle > -55 && modeHandAngle < 45) {
        if (config.mode !== 3) config.mode = 3;
      } else if (modeHandAngle >= -125 && modeHandAngle <= -55) {
        if (config.mode !== 1) config.mode = 1;
      }
    }
  }
  
  // Map hand coordinate to canvas (no mouse interaction fallback)
  let cx = -9999;
  let cy = -9999;
  let isHandActive = false;
  let pinchVal = 0;
  
  if (activeHand) {
    const tip = toCanvas(activeHand.point(INDEX_TIP), fit);
    cx = tip.x;
    cy = tip.y;
    isHandActive = true;
    pinchVal = activeHand.signals.pinch; // 0..1 scale of pinch closeness
  }
  
  // Draw cursor guide
  if (isHandActive) {
    push();
    noFill();
    stroke(0, 243, 255, 150);
    strokeWeight(1.5);
    circle(cx, cy, 25);
    fill(0, 243, 255, 200);
    noStroke();
    circle(cx, cy, 6);
    
    // Draw pinch indicator
    if (pinchVal > 0.1) {
      noFill();
      stroke(255, 0, 127, mapRange(pinchVal, 0.1, 1, 50, 255));
      strokeWeight(2);
      circle(cx, cy, mapRange(pinchVal, 0, 1, 40, 12));
    }
    pop();
  }
  
  // 3. Render Active Mode
  if (config.mode === 1) {
    drawMode1(cx, cy);
  } else if (config.mode === 2) {
    drawMode2(cx, cy, isHandActive, pinchVal);
  } else if (config.mode === 3) {
    drawMode3(cx, cy);
  }
  
  // 4. Render HUD Overlay
  drawHUD(activeHand, modeHand, modeHandAngle);
}

// ---------- Mode 1: Glyph Bezier Morph & Color Shift ----------
function drawMode1(cx, cy) {
  push();
  
  // Set glow shadow
  drawingContext.shadowBlur = 10;
  drawingContext.shadowColor = config.glowColor;
  
  const allContours = [...morphContours1, ...morphContours2];
  
  // Update physics
  for (let contour of allContours) {
    for (let p of contour) {
      let d = dist({ x: cx, y: cy }, { x: p.homeX, y: p.homeY });
      let targetX = p.homeX;
      let targetY = p.homeY;
      
      if (d < config.morphRadius) {
        let angle = atan2(p.homeY - cy, p.homeX - cx);
        let force = mapRange(d, 0, config.morphRadius, config.morphStrength, 0);
        
        targetX += cos(angle) * force;
        targetY += sin(angle) * force;
        
        // Add dynamic sine wave distortion near hover
        let w = sin(frameCount * 0.08 + p.homeX * 0.04) * config.morphNoise * (1 - d / config.morphRadius);
        targetX += cos(angle + HALF_PI) * w;
        targetY += sin(angle + HALF_PI) * w;
      }
      
      // Euler integration with simple spring feedback
      let ax = (targetX - p.x) * config.morphSpring;
      let ay = (targetY - p.y) * config.morphSpring;
      p.vx = (p.vx + ax) * config.morphDamping;
      p.vy = (p.vy + ay) * config.morphDamping;
      p.x += p.vx;
      p.y += p.vy;
    }
  }
  
  // Draw shapes
  if (config.glyphStyle === "points") {
    noStroke();
    for (let contour of allContours) {
      for (let p of contour) {
        let d = dist({ x: cx, y: cy }, { x: p.x, y: p.y });
        if (d < config.morphRadius) {
          let hue = (frameCount * 2.5 + p.homeX * 0.4) % 360;
          fill(`hsl(${hue}, 100%, 65%)`);
          circle(p.x, p.y, mapRange(d, 0, config.morphRadius, 8, 4));
        } else {
          fill(config.textColor);
          circle(p.x, p.y, 3);
        }
      }
    }
  } else if (config.glyphStyle === "lines" || config.glyphStyle === "bezier") {
    for (let contour of allContours) {
      if (contour.length < 3) continue;
      
      if (config.glyphStyle === "bezier") {
        // Draw smooth Catmull-Rom bezier splines contour-by-contour
        noFill();
        
        // Split contour into color-gradient chunks to enable neon highlights
        for (let i = 0; i < contour.length; i++) {
          let p1 = contour[i];
          let p2 = contour[(i + 1) % contour.length];
          let p3 = contour[(i + 2) % contour.length];
          let p4 = contour[(i + 3) % contour.length];
          
          let d = dist({ x: cx, y: cy }, { x: p2.x, y: p2.y });
          if (d < config.morphRadius) {
            let hue = (frameCount * 2.5 + p2.homeX * 0.4) % 360;
            stroke(`hsl(${hue}, 100%, 60%)`);
            strokeWeight(config.morphWeightHover);
          } else {
            stroke(config.textColor);
            strokeWeight(config.morphWeightNormal);
          }
          
          beginShape();
          curveVertex(p1.x, p1.y);
          curveVertex(p2.x, p2.y);
          curveVertex(p3.x, p3.y);
          curveVertex(p4.x, p4.y);
          endShape();
        }
      } else {
        // Direct wireframe segments
        for (let i = 0; i < contour.length; i++) {
          let p1 = contour[i];
          let p2 = contour[(i + 1) % contour.length];
          
          let d = dist({ x: cx, y: cy }, { x: p1.x, y: p1.y });
          if (d < config.morphRadius) {
            let hue = (frameCount * 2.5 + p1.homeX * 0.4) % 360;
            stroke(`hsl(${hue}, 100%, 60%)`);
            strokeWeight(config.morphWeightHover);
          } else {
            stroke(config.textColor);
            strokeWeight(config.morphWeightNormal);
          }
          line(p1.x, p1.y, p2.x, p2.y);
        }
      }
    }
  }
  
  pop();
}

// ---------- Mode 2: Text Particle Gravity Control ----------
function drawMode2(cx, cy, isHandActive, pinchVal) {
  push();
  
  // Set glow shadow
  drawingContext.shadowBlur = 8;
  drawingContext.shadowColor = "rgba(255, 0, 127, 0.4)";
  
  noStroke();
  
  for (let p of particles) {
    let d = dist({ x: cx, y: cy }, { x: p.x, y: p.y });
    
    if (isHandActive) {
      if (d < 1) d = 1;
      
      // Pull force towards cursor
      let fX = cx - p.x;
      let fY = cy - p.y;
      let strength = config.gravityG * (1 + pinchVal * config.pinchMultiplier);
      let force = strength / (d * 0.008 + 1);
      
      // Swirling orbital velocity
      let rotX = -fY / d;
      let rotY = fX / d;
      let orbStrength = config.orbitStrength * (1 + pinchVal * 1.5);
      
      p.vx += (fX / d) * force + rotX * orbStrength;
      p.vy += (fY / d) * force + rotY * orbStrength;
      
      // Soft home return spring even when hand is active so it doesn't float completely away
      let homeFX = p.homeX - p.x;
      let homeFY = p.homeY - p.y;
      p.vx += homeFX * 0.002;
      p.vy += homeFY * 0.002;
    } else {
      // Return spring when no hands are detected
      let homeFX = p.homeX - p.x;
      let homeFY = p.homeY - p.y;
      let hd = dist({ x: p.homeX, y: p.homeY }, { x: p.x, y: p.y });
      if (hd > 0.1) {
        p.vx += (homeFX / (hd + 1)) * config.particleReturnForce + homeFX * 0.01;
        p.vy += (homeFY / (hd + 1)) * config.particleReturnForce + homeFY * 0.01;
      }
    }
    
    // Physics integration
    p.vx *= config.particleDamping;
    p.vy *= config.particleDamping;
    
    // Hard speed limit to avoid particle explosion
    let speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    if (speed > p.speedLimit) {
      p.vx = (p.vx / speed) * p.speedLimit;
      p.vy = (p.vy / speed) * p.speedLimit;
    }
    
    p.x += p.vx;
    p.y += p.vy;
    
    // Draw particles. Velocity shifts hue and size.
    let speedHue = mapRange(speed, 0, 10, 180, 360); // Shifts from Cyan to Magenta
    fill(`hsl(${speedHue % 360}, 100%, 65%)`);
    let size = mapRange(speed, 0, 12, config.particleSize, config.particleSize * 2.0);
    circle(p.x, p.y, size);
  }
  
  pop();
}

// ---------- Mode 3: GSAP Staggered Text Trail ----------
function drawMode3(cx, cy) {
  push();
  
  // Track hand velocity to trigger GSAP stagger pops
  let handSpeed = dist({ x: cx, y: cy }, { x: prevCx, y: prevCy });
  if (handSpeed > 18 && !gsap.isTweening(trailLetters)) {
    // Staggered pop of letters
    gsap.timeline()
      .to(trailLetters, {
        scale: 2.2,
        rotation: () => random(-PI / 3, PI / 3),
        duration: 0.35,
        stagger: {
          each: config.trailDelay,
          from: "start"
        },
        ease: "power2.out"
      })
      .to(trailLetters, {
        scale: 1.0,
        rotation: 0,
        duration: 0.6,
        stagger: {
          each: config.trailDelay * 0.8,
          from: "start"
        },
        ease: "elastic.out(1, 0.4)"
      });
  }
  
  prevCx = cx;
  prevCy = cy;
  
  // History of positions to guide the trail
  if (cx !== -9999) {
    trailHistory.push({ x: cx, y: cy });
  } else {
    // If no active hand, float trail in a smooth circular path in the center of the canvas
    let floatX = width / 2 + cos(frameCount * 0.02) * 120;
    let floatY = height / 2 + sin(frameCount * 0.04) * 60;
    trailHistory.push({ x: floatX, y: floatY });
  }
  if (trailHistory.length > trailLetters.length * 15) {
    trailHistory.shift();
  }
  
  // Render letters trailing the coordinates
  textFont(myFont);
  textAlign(CENTER, CENTER);
  
  drawingContext.shadowBlur = 12;
  
  for (let i = 0; i < trailLetters.length; i++) {
    let letter = trailLetters[i];
    
    // Spacing inside the trail history
    let historyIdx = max(0, trailHistory.length - 1 - i * 3);
    let target = trailHistory[historyIdx] || { x: cx, y: cy };
    
    // Smooth follow
    letter.x = lerp(letter.x, target.x, config.trailSpeed);
    letter.y = lerp(letter.y, target.y, config.trailSpeed);
    
    // Apply dynamic sine wave offset for floating snake effect
    let wY = sin(frameCount * 0.15 + i * 0.4) * config.waveAmplitude;
    let renderY = letter.y + wY;
    
    // Map colors
    let hue = (frameCount * 2.0 + i * 12) % 360;
    fill(`hsl(${hue}, 100%, 65%)`);
    drawingContext.shadowColor = `hsla(${hue}, 100%, 65%, 0.4)`;
    
    textSize(i < 9 ? 65 : 35); // Large text for "Open Call", smaller for subtitle
    
    push();
    translate(letter.x, renderY);
    scale(letter.scale);
    rotate(letter.rotation);
    text(letter.char, 0, 0);
    pop();
  }
  
  pop();
}

// ---------- Hand Skeleton Overlay ----------
function drawHandSkeleton(hand, fit) {
  if (!hand || !hand.raw) return;
  push();
  stroke(`rgba(255, 255, 255, ${config.skeletonOpacity})`);
  strokeWeight(2);
  noFill();

  const getPt = (i) => toCanvas(hand.point(i), fit);
  
  // Draw fingers
  const connections = [
    [0, 1, 2, 3, 4], // thumb
    [0, 5, 6, 7, 8], // index
    [0, 9, 10, 11, 12], // middle
    [0, 13, 14, 15, 16], // ring
    [0, 17, 18, 19, 20], // pinky
    [5, 9, 13, 17] // knuckles
  ];

  for (let lineIdx of connections) {
    beginShape();
    for (let i of lineIdx) {
      let pt = getPt(i);
      if (pt) vertex(pt.x, pt.y);
    }
    endShape();
  }

  // Draw joints
  fill(`rgba(255, 255, 255, ${config.skeletonOpacity})`);
  noStroke();
  for (let i = 0; i < 21; i++) {
    let pt = getPt(i);
    if (pt) circle(pt.x, pt.y, 4);
  }
  pop();
}

// ---------- HUD UI Overlay ----------
function drawHUD(activeHand, modeHand, modeHandAngle) {
  push();
  // Glassmorphic top-left card
  fill(18, 18, 24, 180);
  stroke(255, 255, 255, 30);
  strokeWeight(1);
  rect(20, 20, 310, 230, 12);
  
  noStroke();
  textFont("sans-serif");
  
  // Header
  fill(255);
  textSize(18);
  textStyle(BOLD);
  text("Kinetic Typography HUD", 35, 50);
  
  // Current Mode Title
  textSize(14);
  fill(0, 243, 255);
  let modeName = "1: Glyph Bezier Morph";
  if (config.mode === 2) modeName = "2: Particle Gravity";
  if (config.mode === 3) modeName = "3: GSAP Staggered Trail";
  text(`Active Mode: ${modeName}`, 35, 75);
  
  // Hand tracking state
  fill(170);
  textSize(12);
  textStyle(NORMAL);
  
  let rState = activeHand ? `Active (${activeHand.handedness})` : "Not Detected";
  let lState = modeHand ? `Active (${modeHand.handedness})` : "Not Detected";
  text(`Pointer Hand (Interact):  ${rState}`, 35, 100);
  text(`Mode Hand (Tilt Control): ${lState}`, 35, 118);
  
  if (modeHand) {
    fill(255, 235, 0);
    text(`Mode Hand Tilt: ${Math.round(modeHandAngle)}°`, 35, 136);
  }
  
  // Gestures guide
  fill(120);
  text("Tilt Mode Hand to Switch:", 35, 158);
  
  // Highlight active gesture text
  let m1Color = (config.mode === 1) ? "rgb(0, 243, 255)" : "rgb(150, 150, 150)";
  let m2Color = (config.mode === 2) ? "rgb(255, 0, 127)" : "rgb(150, 150, 150)";
  let m3Color = (config.mode === 3) ? "rgb(170, 255, 0)" : "rgb(150, 150, 150)";
  
  fill(m1Color);
  text("• Vertical Upright (-125° to -55°): Mode 1", 45, 178);
  fill(m2Color);
  text("• Tilt Left (<-125°): Mode 2", 45, 193);
  fill(m3Color);
  text("• Tilt Right (>-55°): Mode 3", 45, 208);
  
  // Secondary manual instructions in bottom center
  textAlign(CENTER, BOTTOM);
  fill(100);
  textSize(11);
  text("Tilt second Hand Left, Upright, or Right to switch modes. Keys '1', '2', '3' also work.", width / 2, height - 20);
  pop();
}

// ---------- lil-gui Control Panel ----------
let gui = null;
function buildGui() {
  gui = new GUI({ title: "Typography Options", width: 300 });
  
  // Mode Controller
  gui.add(config, "mode", { "1: Glyph Morph": 1, "2: Particle Gravity": 2, "3: Staggered Trail": 3 })
     .name("Motion Mode")
     .listen()
     .onChange(val => {
       config.mode = val;
     });
     
  // Styling Folder
  const fStyle = gui.addFolder("General Style");
  fStyle.addColor(config, "bgColor").name("Background");
  fStyle.addColor(config, "textColor").name("Text Base Color");
  fStyle.addColor(config, "glowColor").name("Glow Shadow Color");
  fStyle.add(config, "showCamera").name("Show Feed");
  fStyle.add(config, "cameraOpacity", 0, 1, 0.05).name("Feed Opacity");
  fStyle.add(config, "showHandSkeleton").name("Show Skeleton");
  fStyle.add(config, "skeletonOpacity", 0, 1, 0.05).name("Skeleton Opacity");
  
  // Mode 1 Folder
  const fM1 = gui.addFolder("Mode 1: Glyph Morph");
  fM1.add(config, "glyphStyle", ["bezier", "lines", "points"]).name("Render Mode");
  fM1.add(config, "morphRadius", 50, 400, 10).name("Hover Radius");
  fM1.add(config, "morphStrength", 20, 250, 10).name("Displace Power");
  fM1.add(config, "morphNoise", 0, 50, 1).name("Noise Wave");
  fM1.add(config, "morphSpring", 0.05, 0.5, 0.01).name("Spring Speed");
  fM1.add(config, "morphDamping", 0.5, 0.99, 0.01).name("Damping");
  fM1.add(config, "morphWeightNormal", 0.5, 5, 0.1).name("Line W (Normal)");
  fM1.add(config, "morphWeightHover", 1.0, 10, 0.1).name("Line W (Hover)");
  fM1.close();
  
  // Mode 2 Folder
  const fM2 = gui.addFolder("Mode 2: Gravity Particles");
  fM2.add(config, "particleSize", 1, 10, 0.5).name("Particle Size");
  fM2.add(config, "gravityG", 1, 50, 1).name("Gravity Pull");
  fM2.add(config, "orbitStrength", 0, 15, 0.5).name("Orbital Whirl");
  fM2.add(config, "pinchMultiplier", 1.0, 10, 0.5).name("Pinch Gravity x");
  fM2.add(config, "particleDamping", 0.8, 0.99, 0.01).name("Air Friction");
  fM2.add(config, "particleReturnForce", 0.05, 1.0, 0.05).name("Return Snap");
  fM2.close();
  
  // Mode 3 Folder
  const fM3 = gui.addFolder("Mode 3: Staggered Trail");
  fM3.add(config, "trailDelay", 0.005, 0.1, 0.005).name("GSAP Delay");
  fM3.add(config, "letterSpacing", 10, 60, 5).name("Letter Spacing");
  fM3.add(config, "waveAmplitude", 0, 50, 1).name("Wave Height");
  fM3.add(config, "trailSpeed", 0.05, 0.5, 0.05).name("Follow Speed");
  fM3.close();
  
  // Tracker Folder
  const fTrk = gui.addFolder("Tracking Config");
  fTrk.add(config, "smoothing", 0, 0.95, 0.05).name("Hand Smoothing");
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  
  // Regenerate coordinates based on new window dimensions
  morphContours1 = getTextContours("Open Call", config.fontSize1, -40);
  morphContours2 = getTextContours("creative motion study", config.fontSize2, 60);
  
  const pts1 = getTextParticles("Open Call", config.fontSize1, -40);
  const pts2 = getTextParticles("creative motion study", config.fontSize2, 60);
  particles = [...pts1, ...pts2];
}

// Make p5.js callbacks accessible globally
window.preload = preload;
window.setup = setup;
window.draw = draw;
window.windowResized = windowResized;
