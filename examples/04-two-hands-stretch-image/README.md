# 04 — two hands stretch image

The distance between your two index fingertips scales and rotates an image.

**Input:** two-hand `INDEX_TIP` landmarks
**Mapping:** distance → image width; angle between fingers → rotation
**Output:** a stretched/rotated `image()` between your hands

> Uses a generated stripe pattern. Swap `makeStripes(...)` for `loadImage("yourfile.png")` in `setup()`.

## Try changing
- Replace the placeholder with a real image.
- Tie pinch (single hand) → opacity.
- Use both hand bboxes to warp instead of scale.
