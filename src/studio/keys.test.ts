import test from 'node:test';
import assert from 'node:assert/strict';
import {physicalKey} from './keys.ts';

test('Russian layout letters still map to the physical key', () => {
  assert.equal(physicalKey({code: 'KeyW', key: 'ц'}), 'w');
  assert.equal(physicalKey({code: 'KeyA', key: 'ф'}), 'a');
  assert.equal(physicalKey({code: 'KeyS', key: 'ы'}), 's');
  assert.equal(physicalKey({code: 'KeyD', key: 'в'}), 'd');
  assert.equal(physicalKey({code: 'KeyQ', key: 'й'}), 'q');
  assert.equal(physicalKey({code: 'Space', key: ' '}), ' ');
  assert.equal(physicalKey({code: 'Escape', key: 'Escape'}), 'escape');
  assert.equal(physicalKey({code: 'ArrowLeft', key: 'ArrowLeft'}), 'arrowleft');
});
