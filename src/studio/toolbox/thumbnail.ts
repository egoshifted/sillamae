import * as THREE from 'three';

let renderer: THREE.WebGLRenderer | undefined;

// One small picture of the part's own mesh, so the toolbox shows the model that gets placed.
export function thumbnail(model: THREE.Object3D, size = 64) {
  renderer ??= new THREE.WebGLRenderer({antialias: true, alpha: false, preserveDrawingBuffer: true});
  renderer.setSize(size, size, false);
  renderer.setClearColor('#121614');
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#f4f7fb', '#6d736c', 1.4));
  const sun = new THREE.DirectionalLight('#fff8ee', 1.6);
  sun.position.set(2, 3, 4);
  scene.add(sun);
  const bounds = new THREE.Box3().setFromObject(model);
  const centre = bounds.getCenter(new THREE.Vector3());
  const radius = Math.max(.05, bounds.getSize(new THREE.Vector3()).length() / 2);
  model.position.sub(centre);
  scene.add(model);
  const camera = new THREE.OrthographicCamera(-radius * 1.15, radius * 1.15, radius * 1.15, -radius * 1.15, radius / 50, radius * 20);
  camera.position.set(radius, radius * .72, radius);
  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
  const picture = document.createElement('canvas');
  picture.width = picture.height = size;
  picture.getContext('2d')!.drawImage(renderer.domElement, 0, 0);
  scene.remove(model);
  model.traverse(object => {
    if (object instanceof THREE.Mesh) { object.geometry.dispose(); (object.material as THREE.Material).dispose(); }
  });
  return picture;
}
