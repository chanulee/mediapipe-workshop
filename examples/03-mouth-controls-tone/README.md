# 03 — mouth controls tone

A theremin-ish instrument. Open your mouth to raise pitch; tilt your head to change volume.

**Input:** face `signals.mouthOpen`, `signals.headTilt`
**Mapping:** mouth → frequency (220–880 Hz); tilt → amplitude
**Output:** a `p5.Oscillator` sine tone

> Click the canvas once to allow audio (browsers require a user gesture).

## Try changing
- The frequency range — try a pentatonic snap (round to nearest scale note).
- The oscillator type — `"sawtooth"`, `"square"`, `"triangle"`.
- Add `eyebrowRaise` → a low-pass filter cutoff.
