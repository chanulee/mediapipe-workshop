# face-hand-vibe

Zero-install starter for live **face + hand tracking in the browser** using p5.js and MediaPipe Tasks Vision. The point: spend your time on the *mapping* — what your project does with the signals — not on plumbing.

## Quickstart (60 seconds)

1. Clone or download this repo.
2. **Serve it locally** (browsers block camera on `file://`):
   ```bash
   python3 -m http.server 8000
   # or:  npx serve
   ```
3. Open <http://localhost:8000> in Chrome or Edge. Allow camera access.
4. You should see your webcam with a yellow circle on your nose and pink circles on your index fingertips. Open your mouth — the nose circle grows.
5. Open `sketch.js`. Change one number. Save. Refresh.

## What's here

```
.
├── index.html            entry point
├── sketch.js             YOU EDIT THIS
├── style.css             minimal page styling
├── lib/
│   ├── tracker.js        Tracker class — wraps MediaPipe
│   ├── landmarks.js      named indices (NOSE_TIP, INDEX_TIP, …)
│   ├── signals.js        derived signals (pinch, mouthOpen, …)
│   └── utils.js          smooth(), mapRange(), dist(), debugDraw()
└── examples/
    ├── 01-particles-follow-nose/
    ├── 02-pinch-to-draw/
    ├── 03-mouth-controls-tone/
    ├── 04-two-hands-stretch-image/
    ├── 05-master-controls/      live data inspector + landmark indices
    └── 06-data-flow-graph/      TouchDesigner-style pipeline visualiser
```

Each example folder is self-contained — open its `index.html` directly.

## The API in one sentence

```js
const tracker = new Tracker({ face: true, hands: true });
tracker.start();
tracker.onUpdate(({ face, hands }) => {
  if (face) {
    const mouth = face.signals.mouthOpen; // 0..1
    // ...do something
  }
});
```

That's it. See the full workshop doc for the named landmarks, the full list of derived signals, recipes, and troubleshooting.

## Browser support

Works in recent Chrome and Edge. Safari is mostly fine but slower. Mobile varies.

## Credits

Built on Google's [MediaPipe Tasks Vision](https://developers.google.com/mediapipe/solutions/vision) (Face Landmarker + Hand Landmarker) and [p5.js](https://p5js.org).
