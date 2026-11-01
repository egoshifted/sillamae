import * as THREE from 'three';
import type {AssetDefinition, AssetDetail} from '../../engine/types.ts';

const PERSON = 1.75; // metres
const MOUNT = 1.8; // metres up the wall that wall assets are shown at
const GAP = .8; // metres between the asset, the person and the comparison

// A person of average height, faceless and grey, so nothing about it competes with the asset.
function person() {
  const m = new THREE.MeshStandardMaterial({color: '#8d9399', roughness: .9});
  m.userData.stageOwned = true;
  const group = new THREE.Group();
  const part = (g: THREE.BufferGeometry, x: number, y: number) => { const mesh = new THREE.Mesh(g, m); mesh.position.set(x, y, 0); mesh.castShadow = true; group.add(mesh); };
  for (const x of [-.09, .09]) part(new THREE.CapsuleGeometry(.065, .72, 4, 8), x, .43);
  part(new THREE.CapsuleGeometry(.17, .42, 4, 12), 0, 1.13);
  for (const x of [-.25, .25]) part(new THREE.CapsuleGeometry(.045, .55, 4, 8), x, 1.12);
  part(new THREE.SphereGeometry(.11, 16, 12), 0, PERSON - .12);
  group.name = 'person';
  return group;
}

export interface StageView {
  asset: AssetDefinition;
  variant: string;
  detail: AssetDetail;
  person?: boolean;
  compare?: AssetDefinition; // a library asset shown alongside, at its default variant
}

// A small turntable for one asset: ground, morning light, a person for scale, and
// optionally a known asset beside it. Used by the site editor and by capture tools.
export function createStage(canvas: HTMLCanvasElement, {preserve = false} = {}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, preserveDrawingBuffer: preserve});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor('#e0e6d9');
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, 1, .05, 200), subject = new THREE.Group();
  scene.add(new THREE.HemisphereLight('#e6efff', '#73775c', 1.2), subject);
  const sun = new THREE.DirectionalLight('#fff1dc', 2.4);
  sun.position.set(-6, 9, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.normalBias = .02;
  scene.add(sun);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({color: '#9fae84', roughness: 1}));
  ground.receiveShadow = true;
  scene.add(ground);
  const wallMaterial = new THREE.MeshStandardMaterial({color: '#d8cdb8', roughness: .95});
  let angle = -Math.PI / 5, elevation = .32, box = new THREE.Box3(), spinning = false, frame = 0, grid: THREE.GridHelper | null = null;

  // Asset materials are the shared palette and are never disposed here.
  const disposeBuilt = () => {
    subject.traverse(c => {
      if (!(c instanceof THREE.Mesh)) return;
      c.geometry.dispose();
      if ((c.material as THREE.Material).userData.stageOwned) (c.material as THREE.Material).dispose();
    });
    subject.clear();
  };

  function place(view: StageView) {
    disposeBuilt();
    const object = view.asset.build({variant: view.variant, detail: view.detail});
    let triangles = 0;
    object.traverse(o => {
      if (!(o instanceof THREE.Mesh)) return;
      o.castShadow = o.receiveShadow = true;
      const g = o.geometry as THREE.BufferGeometry;
      triangles += (g.index ? g.index.count : g.attributes.position.count) / 3;
    });
    const size = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
    const wall = view.asset.attach === 'wall';
    if (wall) {
      object.position.y = MOUNT;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(Math.max(2, size.x + 1.5), MOUNT + 1, .3).translate(0, (MOUNT + 1) / 2, -.15), wallMaterial);
      slab.castShadow = slab.receiveShadow = true;
      subject.add(slab);
    }
    subject.add(object);
    let left = -size.x / 2, right = size.x / 2;
    if (view.person !== false) {
      const p = person();
      p.position.set(left - GAP - .25, 0, wall ? .5 : 0);
      left -= GAP + .5;
      subject.add(p);
    }
    if (view.compare && view.compare !== view.asset) {
      const c = view.compare.build({variant: view.compare.variants[0].id, detail: 'near'}), s = new THREE.Box3().setFromObject(c).getSize(new THREE.Vector3());
      c.traverse(o => { if (o instanceof THREE.Mesh) o.castShadow = o.receiveShadow = true; });
      c.position.set(right + GAP + s.x / 2, view.compare.attach === 'wall' ? MOUNT : 0, view.compare.attach === 'wall' ? 0 : (wall ? .5 : 0));
      subject.add(c);
    }
    box = new THREE.Box3().setFromObject(subject);
    if (wall) box.expandByPoint(new THREE.Vector3(0, 0, 1));
    const reach = Math.max(2, box.getSize(new THREE.Vector3()).length() * .75);
    ground.scale.setScalar(reach * 1.4);
    // Metre squares, for reading sizes by eye.
    if (grid) { scene.remove(grid); grid.dispose(); }
    grid = new THREE.GridHelper(Math.ceil(reach * 2.8), Math.ceil(reach * 2.8), '#7d8a68', '#8f9c78');
    Object.assign(grid.material as THREE.Material, {opacity: .35, transparent: true});
    grid.position.y = .002;
    scene.add(grid);
    Object.assign(sun.shadow.camera, {left: -reach * 1.5, right: reach * 1.5, top: reach * 1.5, bottom: -reach * 1.5, near: .1, far: 60});
    sun.shadow.camera.updateProjectionMatrix();
    aim();
    return {triangles, size: size.toArray() as [number, number, number]};
  }

  function aim() {
    const centre = box.getCenter(new THREE.Vector3()), radius = box.getSize(new THREE.Vector3()).length() / 2 || 1;
    const distance = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.05;
    camera.position.set(centre.x + Math.sin(angle) * Math.cos(elevation) * distance, centre.y + Math.sin(elevation) * distance, centre.z + Math.cos(angle) * Math.cos(elevation) * distance);
    camera.lookAt(centre);
    sun.target.position.copy(centre);
    scene.add(sun.target);
  }

  function resize(width: number, height: number) {
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
  }

  function render() { renderer.render(scene, camera); }

  function loop() {
    if (!spinning) return;
    angle += .006;
    aim();
    render();
    frame = requestAnimationFrame(loop);
  }

  return {
    renderer, place, render, resize,
    // Degrees round from the front, and above the ground.
    view(degrees: number, up = 18) { angle = THREE.MathUtils.degToRad(degrees); elevation = THREE.MathUtils.degToRad(up); aim(); render(); },
    spin(on: boolean) { spinning = on; cancelAnimationFrame(frame); if (on) loop(); },
    dispose() { spinning = false; cancelAnimationFrame(frame); disposeBuilt(); renderer.dispose(); },
  };
}
