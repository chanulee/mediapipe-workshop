# 01 — particles follow nose

A field of particles that drift toward your nose.

**Input:** face landmark (`NOSE_TIP`)
**Mapping:** distance from particle to nose → attractor force
**Output:** 300 p5 particles with simple velocity

## Try changing
- The `1` in `mapRange(distance, 0, 200, 1, 0)` — make it `5` and feel the slam.
- The `0.9` damping factor — try `0.95` (floatier) or `0.7` (snappier).
- The particle count (`300`).
