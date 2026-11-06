import test from 'node:test';
import assert from 'node:assert/strict';
import {installInertCanvas} from './inert-canvas.ts';
import {paintWear, wear} from '../../city/sillamae/kesk8a/wear.ts';

test('painting with gradients on an inert canvas leaves a texture and no error', () => {
  installInertCanvas();
  for (const sheet of Object.values(wear)) assert.ok(paintWear(sheet, 1));
  const context = document.createElement('canvas').getContext('2d')!;
  assert.equal(context.getImageData(0, 0, 2, 3).data.length, 24);
  assert.equal(context.fillRect(0, 0, 1, 1), undefined);
});
