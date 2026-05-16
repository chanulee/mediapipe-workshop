# 06 — Data-flow graph

A TouchDesigner-style canvas that shows the workshop pipeline running live.

```
Camera ─video──► Face Landmarker ─landmarks──► Face Signals ─signals──┐
       ─video──► Hand Landmarker ─landmarks──► Hand Signals ─signals──┤
       ─video───────────────────────────────────────────────────────► Renderer
                    └─ raw landmarks ─────────────────────────────────►
```

## What's on screen

- Each block is a real stage in the pipeline. Coloured dots on its left/right
  edges are its **input/output ports**. Connections route port → port via
  curved bezier paths; a small "data packet" pulses along each active line.
- **Edge colour** = data type: orange `video`, green `landmarks`, blue `signals`.
- A path goes **dim and dashed** when its source isn't producing — e.g. the
  Face Signals edges fade out the instant your face leaves frame.
- Status dot on each node header pulses while that node is actively emitting.

## What you can do

- **Drag** empty space → pan the canvas.
- **Wheel** → zoom toward the cursor (25%–250%).
- **fit** / **reset** buttons in the toolbar — re-frame the graph or jump to
  100% at the origin.
- **pause** / **resume** — freezes the tracker so you can inspect a single frame.
- **Smoothing** slider (on Face Signals / Hand Signals) — adjusts the temporal
  blend, both sliders write to the same `tracker.opts.smoothing`.
- **Renderer node** has checkboxes (mirror, show camera, face/hand landmarks,
  indices) and an opacity slider. Toggling these flips edges on/off in real
  time so students can see *which* data path is currently feeding the render.
- **Live readouts** inside each node: camera resolution / readyState / fps;
  face count and nose position; hand count and handedness; every signal port
  shows its current numeric value.

Open this folder via the local server (e.g. `http://localhost:8000/examples/06-data-flow-graph/`).
