// Tracker — wraps MediaPipe Tasks Vision (face + hand) behind a tiny callback API.
// See the workshop doc for usage. Treat this file as plumbing.

import {
  FaceLandmarker,
  HandLandmarker,
  FilesetResolver,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";

import { computeFaceSignals, computeHandSignals } from "./signals.js";

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const FACE_MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const HAND_MODEL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export class Tracker {
  constructor(opts = {}) {
    this.opts = {
      face: true,
      hands: true,
      maxHands: 2,
      smoothing: 0.5,
      flip: true,
      deviceId: null,
      ...opts,
    };
    this.callbacks = [];
    this.video = null;
    this.faceLandmarker = null;
    this.handLandmarker = null;
    this.lastFace = null;
    this.lastHands = [];
    this.lastVideoTime = -1;
    this.running = false;
  }

  onUpdate(cb) { this.callbacks.push(cb); }

  async start() {
    if (this.running) return;

    // 1. MediaPipe runtime
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);

    // 2. Models (parallel for faster startup)
    const tasks = [];
    if (this.opts.face) {
      tasks.push(FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: FACE_MODEL, delegate: "GPU" },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: false,
      }).then((lm) => { this.faceLandmarker = lm; }));
    }
    if (this.opts.hands) {
      tasks.push(HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: HAND_MODEL, delegate: "GPU" },
        runningMode: "VIDEO",
        numHands: this.opts.maxHands,
      }).then((lm) => { this.handLandmarker = lm; }));
    }
    await Promise.all(tasks);

    // 3. Webcam
    this.video = document.createElement("video");
    this.video.autoplay = true;
    this.video.playsInline = true;
    this.video.muted = true;
    if (this.opts.flip) this.video.style.transform = "scaleX(-1)";
    this.video.style.display = "none";
    document.body.appendChild(this.video);

    const constraints = {
      video: this.opts.deviceId
        ? { deviceId: { exact: this.opts.deviceId } }
        : { width: 1280, height: 720 },
      audio: false,
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    this.video.srcObject = stream;
    await new Promise((r) => (this.video.onloadeddata = r));
    await this.video.play();

    // 4. Loop
    this.running = true;
    this._loop();
  }

  _loop() {
    if (!this.running) return;
    const now = performance.now();

    if (this.video.currentTime !== this.lastVideoTime && this.video.readyState >= 2) {
      this.lastVideoTime = this.video.currentTime;

      let faceResult = null;
      let handResult = null;
      try {
        if (this.faceLandmarker) faceResult = this.faceLandmarker.detectForVideo(this.video, now);
        if (this.handLandmarker) handResult = this.handLandmarker.detectForVideo(this.video, now);
      } catch (err) {
        // MediaPipe sometimes throws on the very first frame; swallow and retry.
        console.warn("[tracker] detection error", err);
      }

      const face = this._wrapFace(faceResult);
      const hands = this._wrapHands(handResult);

      this.lastFace = face;
      this.lastHands = hands;

      this.callbacks.forEach((cb) =>
        cb({ face, hands, video: this.video, ts: now })
      );
    }
    requestAnimationFrame(() => this._loop());
  }

  _wrapFace(result) {
    if (!result || !result.faceLandmarks?.length) return null;
    const raw = result.faceLandmarks[0].map(this._maybeFlip.bind(this));
    return {
      raw,
      point: (i) => raw[i] || null,
      signals: computeFaceSignals(raw, this.opts.smoothing, this.lastFace),
      bbox: bboxFrom(raw),
    };
  }

  _wrapHands(result) {
    if (!result || !result.landmarks?.length) return [];
    return result.landmarks.map((lm, i) => {
      const raw = lm.map(this._maybeFlip.bind(this));
      // handedness label is from the original camera image. If we mirror, swap labels
      // so "Right" really is the user's right hand (the one on the right of the screen).
      let label = result.handednesses?.[i]?.[0]?.categoryName || "Unknown";
      if (this.opts.flip) {
        if (label === "Left") label = "Right";
        else if (label === "Right") label = "Left";
      }
      return {
        raw,
        point: (j) => raw[j] || null,
        signals: computeHandSignals(raw, this.opts.smoothing, this.lastHands[i]),
        handedness: label,
        bbox: bboxFrom(raw),
      };
    });
  }

  _maybeFlip(pt) {
    if (this.opts.flip) return { x: 1 - pt.x, y: pt.y, z: pt.z };
    return pt;
  }

  stop() {
    this.running = false;
    if (this.video?.srcObject) {
      this.video.srcObject.getTracks().forEach((t) => t.stop());
    }
    if (this.video?.parentNode) {
      this.video.parentNode.removeChild(this.video);
    }
    this.faceLandmarker?.close?.();
    this.handLandmarker?.close?.();
    this.video = null;
  }
}

function bboxFrom(pts) {
  let minX = 1, minY = 1, maxX = 0, maxY = 0;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
