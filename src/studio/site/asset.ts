/// <reference types="vite/client" />
import {assetById} from '../../city/sillamae/assets/library.ts';
import type {AssetDetail} from '../../engine/types.ts';
import {createStage} from './stage.ts';

// One asset on the preview stage, full page, for capture tools (tools/asset-preview.ts).
// window.assetPreview.show() places it and returns its measurements.
export interface PreviewRequest {
  id: string;
  variant?: string;
  detail?: AssetDetail;
  view?: number; // degrees round from the front
  up?: number; // degrees above the ground
  person?: boolean;
  compare?: string;
}

const canvas = document.getElementById('stage') as HTMLCanvasElement, stage = createStage(canvas, {preserve: true});
const fit = () => stage.resize(canvas.clientWidth, canvas.clientHeight);
fit();
addEventListener('resize', () => { fit(); stage.render(); });

function show(request: PreviewRequest) {
  const asset = assetById.get(request.id);
  if (!asset) throw Error('Unknown asset ' + request.id);
  const variant = request.variant ?? asset.variants[0].id;
  if (!asset.variants.some(v => v.id === variant)) throw Error(`${asset.id} has no variant ${variant}`);
  const built = stage.place({asset, variant, detail: request.detail ?? 'near', person: request.person ?? true, compare: request.compare ? assetById.get(request.compare) : undefined});
  stage.view(request.view ?? -36, request.up ?? 18);
  return {...built, declared: asset.size, budget: asset.triangles, variants: asset.variants.map(v => v.id), attach: asset.attach};
}

const params = new URLSearchParams(location.search);
const assetPreview = {ready: false, show};
Object.assign(window, {assetPreview});
try {
  if (params.has('id')) show({id: params.get('id')!, variant: params.get('variant') ?? undefined, detail: (params.get('detail') as AssetDetail) ?? undefined, view: params.has('view') ? Number(params.get('view')) : undefined});
} catch (e) { document.getElementById('error')!.textContent = String(e); }
assetPreview.ready = true;
