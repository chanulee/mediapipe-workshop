import assert from 'node:assert/strict';
import { steps, completes, reaction } from './lesson.mjs';
assert.equal(steps.length, 8);
assert.equal(completes(1, 'hands', 1), false);
assert.equal(completes(1, 'hands', 2), true);
assert.equal(completes(2, 'spread', 0.17), false);
assert.equal(completes(2, 'spread', 0.19), true);
assert.equal(completes(3, 'amount', 60), false);
assert.equal(completes(3, 'amount', 80), true);
assert.equal(completes(5, 'effect', 'rotate'), false);
assert.equal(completes(6, 'effect', 'size'), false);
assert.equal(completes(8, 'ready'), false);
for (const effect of ['size', 'rotate', 'opacity', 'shake']) {
  for (const d of [0, 0.08, 0.3, 0.7, 2]) {
    const normal = reaction(d, 1, false, 100, effect);
    const reversed = reaction(d, 1, true, 100, effect);
    assert.equal(normal.value + reversed.value, 1);
    assert(normal.opacity >= 0 && normal.opacity <= 1);
    assert(normal.size >= 90 && normal.size <= 530);
    assert(Object.values(normal).every(Number.isFinite));
  }
}
assert(reaction(0.7, 1, false, 100, 'size').size > reaction(0.08, 1, false, 100, 'size').size);
assert(reaction(0.7, 1, true, 100, 'size').size < reaction(0.08, 1, true, 100, 'size').size);
console.log('PASS: tutorial gates, distance mapping, reversal, and effect boundaries');
