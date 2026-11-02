import * as THREE from 'three';
import {crownGeometry, foliageMaterials} from '../../../engine/vegetation/trees.ts';
import {assemble, box, cylinder, graphic, organic, palette, rod, type Part} from './palette.ts';

export function wasteLabel(kind: string) {
  return graphic('waste-' + kind, c => {
    c.fillStyle = '#e0ded4'; c.fillRect(0, 0, 256, 256);
    c.fillStyle = '#303936'; c.textAlign = 'center'; c.font = 'bold 28px sans-serif';
    c.fillText(kind === 'paper' ? 'PABER' : kind === 'bio' ? 'BIO' : 'OLME', 128, 45);
    c.lineWidth = 6; c.strokeStyle = '#303936';
    if (kind === 'paper') {
      c.strokeRect(57, 91, 125, 110);
      for (let y = 116; y < 191; y += 23) { c.beginPath(); c.moveTo(75, y); c.lineTo(164, y); c.stroke(); }
      c.beginPath(); c.moveTo(190, 110); c.lineTo(205, 110); c.lineTo(205, 218); c.lineTo(78, 218); c.stroke();
    } else if (kind === 'bio') {
      c.beginPath(); c.ellipse(128, 151, 51, 70, .5, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(89, 221); c.lineTo(157, 104); c.moveTo(120, 168); c.lineTo(99, 137); c.moveTo(134, 146); c.lineTo(165, 146); c.stroke();
    } else {
      c.beginPath(); c.moveTo(104, 87); c.lineTo(149, 87); c.lineTo(137, 112); c.bezierCurveTo(213, 184, 190, 222, 127, 222); c.bezierCurveTo(58, 222, 45, 181, 117, 112); c.closePath(); c.stroke();
      c.beginPath(); c.moveTo(107, 113); c.lineTo(150, 113); c.stroke();
    }
  });
}

export function wasteDrum(kind: string, small: boolean, detail: string) {
  const r = small ? .45 : .85, n = detail === 'near' ? 16 : 8, dark = palette.paint('#303331');
  const parts: Part[] = [
    [cylinder(r * .98, r * .98, .82, n), organic('#45433e')],
    [cylinder(r, r, .055, n, 0, .055), dark],
    [cylinder(r, r, .08, n, 0, .84), dark],
    [new THREE.SphereGeometry(r, n, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, .25 / r, 1).translate(0, .85, 0), dark],
    [new THREE.SphereGeometry(r + .012, 6, 3, Math.PI / 2 - .36, .72, .18, .95).scale(1, .25 / r, 1).translate(0, .86, 0), palette.paint(kind === 'paper' ? '#356bc4' : kind === 'bio' ? '#675444' : '#555955')],
    [new THREE.PlaneGeometry(small ? .26 : .34, .38).translate(0, .49, r + .014), wasteLabel(kind)],
  ];
  if (detail === 'near') for (let i = 0; i < n; i += 2) {
    const a = (i + .5) / n * Math.PI * 2;
    parts.push([box(.018, .72, .025, 0, 0).rotateY(a).translate(Math.sin(a) * r * .982, .43, Math.cos(a) * r * .982), dark]);
  }
  return assemble(parts, 'waste-drum');
}

const shrubMaterials = new Map<string, ReturnType<typeof foliageMaterials>>();
export function shrub(size: [number, number, number], detail: string, spreading: boolean, variant = 'atlas') {
  const parts: Part[] = [], bark = organic('#5c4f45');
  for (let i = 0; i < 8; i++) {
    const a = i * 2.399, rise = .7 + (i % 3) * .12;
    const end: THREE.Vector3Tuple = [Math.sin(a) * .7, rise, Math.cos(a) * .7];
    parts.push([rod([Math.sin(a) * .06, 0, Math.cos(a) * .06], end, .025, 5), bark]);
    for (let j = 0; j < 3; j++) {
      const b = a + (j - 1) * .45;
      parts.push([rod([end[0] * .7, rise * .65, end[2] * .7], [Math.sin(b) * (.8 + j * .08), rise + .3 + j * .12, Math.cos(b) * (.8 + j * .08)], .009, detail === 'near' ? 5 : 3), bark]);
    }
  }
  const root = assemble(parts, 'shrub');
  const fit = (geometries: THREE.BufferGeometry[]) => {
    const bounds = new THREE.Box3();
    for (const g of geometries) { g.computeBoundingBox(); bounds.union(g.boundingBox!); }
    const extent = bounds.getSize(new THREE.Vector3()), centre = bounds.getCenter(new THREE.Vector3());
    for (const g of geometries) g.translate(-centre.x, -bounds.min.y, -centre.z).scale(size[0] / extent.x, size[1] / extent.y, size[2] / extent.z);
  };
  fit(root.children.map(o => (o as THREE.Mesh).geometry));
  if (variant !== 'winter') {
    for (const o of root.children) (o as THREE.Mesh).geometry.scale(.65, .78, .65);
    const season = variant === 'spring' || variant === 'summer' || variant === 'autumn' ? variant : 'atlas';
    let materials = shrubMaterials.get(season);
    if (!materials) shrubMaterials.set(season, materials = foliageMaterials(season));
    const material = detail === 'near' ? materials.near : materials.far;
    const geometry = crownGeometry(false, spreading ? 1.3 : 2.1, detail === 'near' ? 2 : 0);
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox!, extent = bounds.getSize(new THREE.Vector3()), centre = bounds.getCenter(new THREE.Vector3());
    const base = size[1] * (spreading ? .08 : .22);
    geometry.translate(-centre.x, -bounds.min.y, -centre.z).scale(size[0] / extent.x, (size[1] - base) / extent.y, size[2] / extent.z).translate(0, base, 0);
    const colour = new THREE.Color(season === 'spring' ? '#a1b95d' : '#7f9e48'), colors = geometry.attributes.color;
    for (let i = 0; i < colors.count; i++) { const light = colors.getX(i); colors.setXYZ(i, colour.r * light, colour.g * light, colour.b * light); }
    const mesh = new THREE.Mesh(geometry, material.leaf);
    mesh.customDepthMaterial = material.depth;
    mesh.castShadow = true;
    root.add(mesh);
  }
  return root;
}
