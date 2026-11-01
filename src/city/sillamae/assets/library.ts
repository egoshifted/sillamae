/// <reference types="vite/client" />
import type {AssetDefinition} from '../../../engine/types.ts';

// The library is the approved asset folders; drafts wait in ../asset-drafts/ for
// review, at the same depth so approval moves a folder without touching its imports.
// A folder's name is its asset's id. Node tools read the folders directly (tools/assets.ts).
const approved = import.meta.glob<{asset: AssetDefinition}>('./*/asset.ts', {eager: true});
const pending = import.meta.glob<{asset: AssetDefinition}>('../asset-drafts/*/asset.ts', {eager: true});

function collect(modules: Record<string, {asset: AssetDefinition}>) {
  return Object.entries(modules).map(([path, module]) => {
    const folder = path.split('/').at(-2);
    if (module.asset?.id !== folder) throw Error(`Asset in ${path} must have the id ${folder}`);
    return module.asset;
  });
}

export const library = collect(approved);
export const drafts = collect(pending);
const ids = [...library, ...drafts].map(a => a.id);
if (new Set(ids).size !== ids.length) throw Error('Duplicate asset id: ' + ids.find((id, i) => ids.indexOf(id) !== i));
export const assetById = new Map([...library, ...drafts].map(a => [a.id, a]));
