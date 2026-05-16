# 02 — pinch to draw

Pinch your thumb and index finger to start a stroke; release to lift the pen.
Press **C** to clear.

**Input:** hand landmarks (`THUMB_TIP`, `INDEX_TIP`) + `signals.pinch`
**Mapping:** pinch > 0.75 → pen down
**Output:** accumulated strokes on an off-screen p5 graphics layer

## Try changing
- The threshold `0.75` — looser (`0.6`) or stricter (`0.85`).
- `strokeWeight(4)` — make it react to pinch strength.
- Stroke colour — tie it to `h.signals.openness` or `pinch`.
