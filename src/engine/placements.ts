import * as THREE from 'three';
import type {AssetDefinition, AssetDetail, Placement, WorldFrame} from './types.ts';

const CHUNK = 120; // metres
// Near detail within this distance of the view centre and above this pixel density; far detail beyond.
const NEAR = {distance: 220, ppm: 4};
// An asset smaller than this many pixels across is not drawn at all.
const VISIBLE_PIXELS = 1.5;
// Depth-only lift over the survey ground and roads (see roads.ts, stairs.ts), whose
// lifts would otherwise cut off the foot of anything standing on them.
const DEPTH_LIFT = 1;

const lifted = new Map<THREE.Material, THREE.Material>();
function liftedMaterial(material: THREE.Material) {
  let m = lifted.get(material);
  if (!m) {
    m = material.clone();
    m.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>\ngl_Position.z += projectionMatrix[2][2] * ${DEPTH_LIFT}.;`);
    };
    m.customProgramCacheKey = () => 'placement-lift';
    lifted.set(material, m);
  }
  return m;
}

interface Batch {
  size: number; // the asset's largest dimension, metres
  levels: Record<AssetDetail, THREE.Group>;
}

// One instanced mesh per asset, variant, detail and material in each chunk: a
// street of benches costs a few draws, whatever its length.
export function addPlacements(parent: THREE.Object3D, placements: Placement[], assets: ReadonlyMap<string, AssetDefinition>, frame: WorldFrame) {
  const [ox, oz] = frame.origin, root = new THREE.Group();
  root.name = 'placements';
  parent.add(root);
  const prototypes = new Map<string, THREE.Object3D>();
  const prototype = (asset: AssetDefinition, variant: string, detail: AssetDetail) => {
    const key = `${asset.id}:${variant}:${detail}`;
    let p = prototypes.get(key);
    if (!p) { prototypes.set(key, p = asset.build({variant, detail})); p.updateMatrixWorld(true); }
    return p;
  };

  const chunks = new Map<string, {centre: THREE.Vector3; groups: Map<string, Placement[]>}>();
  for (const p of placements) {
    const asset = assets.get(p.asset);
    if (!asset) continue;
    const x = p.p[0] - ox, z = p.p[1] - oz, key = Math.floor(x / CHUNK) + ',' + Math.floor(z / CHUNK);
    let chunk = chunks.get(key);
    if (!chunk) chunks.set(key, chunk = {centre: new THREE.Vector3((Math.floor(x / CHUNK) + .5) * CHUNK, 0, (Math.floor(z / CHUNK) + .5) * CHUNK), groups: new Map()});
    const group = asset.id + ':' + (p.variant ?? asset.variants[0].id);
    chunk.groups.set(group, [...chunk.groups.get(group) ?? [], p]);
  }

  const placed = new THREE.Matrix4(), position = new THREE.Vector3(), turn = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
  const built: {centre: THREE.Vector3; batches: Batch[]}[] = [];
  for (const {centre, groups} of chunks.values()) {
    const batches: Batch[] = [];
    for (const [key, list] of groups) {
      const asset = assets.get(list[0].asset)!, variant = key.slice(asset.id.length + 1);
      const levels = {near: new THREE.Group(), far: new THREE.Group()};
      for (const detail of ['near', 'far'] as const) {
        prototype(asset, variant, detail).traverse(o => {
          if (!(o instanceof THREE.Mesh)) return;
          const mesh = new THREE.InstancedMesh(o.geometry, liftedMaterial(o.material as THREE.Material), list.length);
          list.forEach((p, i) => {
            placed.compose(position.set(p.p[0] - ox, p.p[2] - frame.base, p.p[1] - oz), turn.setFromAxisAngle(up, p.heading), one);
            mesh.setMatrixAt(i, placed.multiply(o.matrixWorld));
          });
          mesh.computeBoundingSphere();
          mesh.castShadow = detail === 'near';
          mesh.receiveShadow = true;
          levels[detail].add(mesh);
        });
        levels[detail].visible = false;
        root.add(levels[detail]);
      }
      batches.push({size: Math.max(...asset.size), levels});
    }
    built.push({centre, batches});
  }

  let state = '';
  return {
    count: placements.length,
    // Returns true when what is drawn changed, so shadows are redrawn.
    update(target: THREE.Vector3, pixelsPerMetre: number) {
      const next: string[] = [];
      for (const {centre, batches} of built) {
        const near = pixelsPerMetre > NEAR.ppm && Math.hypot(centre.x - target.x, centre.z - target.z) < NEAR.distance;
        for (const b of batches) {
          const shown = b.size * pixelsPerMetre >= VISIBLE_PIXELS;
          b.levels.near.visible = shown && near;
          b.levels.far.visible = shown && !near;
          next.push(b.levels.near.visible ? 'n' : b.levels.far.visible ? 'f' : '-');
        }
      }
      const key = next.join('');
      if (key === state) return false;
      state = key;
      return true;
    },
  };
}
