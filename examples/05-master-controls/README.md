# 05 — master controls

Everything from the boilerplate plus a live GUI (powered by [lil-gui](https://lil-gui.georgealways.com/)) so you can toggle the camera feed, recolor the dots, peek at raw signals, and flip on the "show all landmarks" debug overlay.

Useful when you're prototyping a new sketch and want to feel out which signals respond to what.

## Run

Serve the repo root and open `examples/05-master-controls/`:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000/examples/05-master-controls/
```

## What's wired up

- **camera** — show / hide feed, opacity, mirror toggle
- **overlays** — face dot, hand dots, all-landmarks debug, index labels
- **colors** — background, face dot, hand dot (color pickers)
- **sizes** — min/max for the mouth→nose and openness→hand mappings
- **live signals** — `mouthOpen`, `smile`, `pinch`, `openness`, `fingerCount` updating each frame

The hand dot scales with `signals.openness` — closed fist is small, open palm is large.
