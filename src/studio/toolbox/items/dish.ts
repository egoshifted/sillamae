import * as THREE from 'three';
import type {ToolboxItem} from '../item.ts';

const metal = () => new THREE.MeshStandardMaterial({color: '#d5d8dc', roughness: .4, metalness: .55});
const dark = () => new THREE.MeshStandardMaterial({color: '#2a2e32', roughness: .55, metalness: .35});

function model() {
  const root = new THREE.Group();
  const shell = metal(), mount = dark();
  const plate = new THREE.Mesh(new THREE.BoxGeometry(.14, .18, .025), mount);
  plate.position.set(0, 0, .012);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, .16, 8), mount);
  post.position.set(0, .02, .1);
  const profile = [[.02, 0], [.22, .045], [.3, .09], [.31, .1], [.22, .055], [.02, .01]].map(([x, y]) => new THREE.Vector2(x, y));
  const dish = new THREE.Mesh(new THREE.LatheGeometry(profile, 28), shell);
  dish.rotation.x = Math.PI / 2;
  dish.position.set(0, .04, .16);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .22, 6), mount);
  arm.rotation.x = Math.PI / 2.4;
  arm.position.set(0, .02, .28);
  const lnb = new THREE.Mesh(new THREE.BoxGeometry(.04, .04, .07), mount);
  lnb.position.set(0, -.02, .38);
  root.add(plate, post, dish, arm, lnb);
  root.traverse(object => { if (object instanceof THREE.Mesh) object.castShadow = object.receiveShadow = true; });
  return root;
}

export const satelliteDish: ToolboxItem = {
  id: 'satellite-dish',
  name: 'Satellite dish',
  hint: 'Click the building to place the satellite dish. Delete removes the selected dish.',
  create: model,
};
