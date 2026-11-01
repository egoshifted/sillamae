import type {AssetDefinition} from '../../engine/types.ts';
import {createStage} from './stage.ts';

const SIZE = 88; // pixels; shown at half size, sharp on high-density screens

// Small pictures of each asset for the palette, drawn one at a time on a canvas
// of their own and kept as data URLs for the page's life.
const made = new Map<string, string>();
let stage: ReturnType<typeof createStage> | null = null, canvas: HTMLCanvasElement | null = null;

export function thumbnail(asset: AssetDefinition) {
  const key = asset.id + ':' + asset.variants[0].id;
  let url = made.get(key);
  if (url) return url;
  if (!stage) {
    canvas = document.createElement('canvas');
    stage = createStage(canvas, {preserve: true});
    stage.renderer.setPixelRatio(1);
    stage.resize(SIZE, SIZE);
  }
  // A draft that fails to build still gets a row; its preview shows the error.
  try {
    stage.place({asset, variant: asset.variants[0].id, detail: 'near', person: false});
    stage.view(-36, asset.attach === 'wall' ? 8 : 22);
    url = canvas!.toDataURL('image/png');
  } catch { url = ''; }
  made.set(key, url);
  return url;
}
