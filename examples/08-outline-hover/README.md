# 08 — outline hover

Mouse-hover glyph outline morph. No MediaPipe / camera.

## Why outlines were cracking

p5 `font.textToPoints()` **samples** the glyph into a polyline. Reconnecting those samples with Catmull-Rom (`curveVertex`) invents new curves that don’t match the font’s real cubic beziers — you get spikes and gaps at joins.

## Fix

Use [opentype.js](https://opentype.js.org/) `font.getPath()` and draw the actual SVG path commands (`M` / `L` / `Q` / `C` / `Z`) with canvas `bezierCurveTo`. Hover displaces the path’s control points; the stroke stays a continuous closed bezier.

## Run

```bash
python3 -m http.server 8000
# http://localhost:8000/examples/08-outline-hover/
```
