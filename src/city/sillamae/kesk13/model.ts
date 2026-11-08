import {makeAddressSigns} from './signs.ts';
import {finishOpening, finishRoof, addressPlaques, sheetLaps} from './finishing.ts';
import {finishMaterials} from './surfaces.ts';
import {wearUniforms} from './wear.ts';
import * as THREE from 'three';
import type {OverrideContext} from '../../../engine/types.ts';
import type {StudyModel} from '../../../studio/types.ts';
import {courtyardNotch, eaveHeight, baseElevation, eaves, ridges, roofPlanes, surveyRoof, levelCourtyardRoof, type SurveyPoint} from './design.ts';

import {addCourtyardDetail, addCourtyardCornice} from './courtyard.ts';
import {refinedLevels} from './levels.ts';
import {addBalconyOrnament, addWindowPanel, addPlinth} from './ornament.ts';
import {corrugatedNormal, roofUV} from './roof-finish.ts';
import {addDownpipes, addEntranceFrame, downpipes, streetDownpipes} from './access.ts';
import {addMouldings, addCornerRustication, quoinCorners} from './mouldings.ts';
import {addJoinery} from './joinery.ts';
import {addChimneys} from './chimneys.ts';
import {addVentedRoof} from './roof.ts';
import {addCornice, wallCorners} from './cornice.ts';
import {addOpeningWall, courtyardWalls, endWalls, streetWalls} from './street.ts';

export function createShell(context: OverrideContext) { return build(context, 'shell'); }
export function createStreet(context: OverrideContext) { return build(context, 'street'); }
export function createBuilding(context: OverrideContext) { return build(context, 'courtyard'); }
export function createEnds(context: OverrideContext) { return build(context, 'ends'); }
export function createEnvelope(context: OverrideContext) { return build(context, 'envelope'); }

export function createRoof(context: OverrideContext) { return build(context, 'roof'); }

export function createDetails(context: OverrideContext) { return build(context, 'details'); }

export function createFacade(context: OverrideContext) { return build(context, 'facade'); }

export function createMouldings(context: OverrideContext) { return build(context, 'mouldings'); }

export function createAccess(context: OverrideContext) { return build(context, 'access'); }

export function createOrnament(context: OverrideContext) { return build(context, 'ornament'); }

export function createProportions(context: OverrideContext) { return build(context, 'proportions'); }

export function createCourtyardDetails(context: OverrideContext) { return build(context, 'courtyard-details'); }

export function createRoofCorrection(context: OverrideContext) { return build(context, 'roof-correction'); }

export function createFinished(context: OverrideContext) { return build(context, 'finished'); }

function build({building, frame, scene}: OverrideContext, stage: 'shell' | 'street' | 'courtyard' | 'ends' | 'envelope' | 'roof' | 'details' | 'facade' | 'mouldings' | 'access' | 'ornament' | 'proportions' | 'courtyard-details' | 'roof-correction' | 'finished'): StudyModel {
  const complete = stage === 'finished';
  const roofShape = complete ? courtyardNotch : stage === 'roof-correction' ? levelCourtyardRoof : surveyRoof;
  const courtyard = complete || stage === 'courtyard-details' || stage === 'roof-correction';
  const levels = stage === 'proportions' || courtyard ? refinedLevels : undefined;
  const ornament = stage === 'ornament' || !!levels, access = stage === 'access' || ornament, finished = stage === 'mouldings' || access;
  const roofFinish: number[] = [], trimFinish: number[] = [], plinth: number[] = [], brick: number[] = [];
  const roofNormal = ornament ? corrugatedNormal() : undefined;
  const positions: number[] = [], infills: number[] = [], doors: number[] = [];
  const metals: number[] = [], flues: number[] = [];
  const whites: number[] = [], browns: number[] = [], irons: number[] = [];
  const parts = new Map<string, {name: string; positions: number[]; material: number}>();
  let active = '';
  function part(id: string, name: string) {
    active = 'kesk13/' + id;
    if (!parts.has(active)) parts.set(active, {name, positions: [], material: 0});
  }
  function emit(target: number[], material: number) {
    return ([x, z, h]: SurveyPoint) => {
      const point = [x - building.c[0], h - baseElevation, z - building.c[1]];
      target.push(...point);
      if (scene.userData.keepParts) {
        const current = parts.get(active)!;
        current.positions.push(...point);
        current.material = material;
      }
    };
  }
  const wallVertex = emit(positions, 0), roofVertex = emit(roofFinish, 8), trimVertex = emit(trimFinish, 9);
  const vertex = (p: SurveyPoint) => (finished && (/\/roof-/.test(active) || /\/vent-.*\/hood$/.test(active)) ? roofVertex : finished && /\/cornice-/.test(active) ? trimVertex : wallVertex)(p);
  const inset = emit(infills, 1), door = emit(doors, 2);

  const facade = stage === 'facade' || finished;
  const detailed = stage === 'details' || facade, vented = stage === 'roof' || detailed;
  const envelope = stage === 'envelope' || vented;
  const walls = envelope ? wallCorners(roofShape.eaves) : eaves;
  for (let i = 0; i < walls.length; i++) {
    const pa = walls[i], pb = walls[(i + 1) % walls.length], heights = roofShape.edgeHeights?.[i];
    const a: SurveyPoint = [pa[0],pa[1],heights?.[0] ?? pa[2]], b: SurveyPoint = [pb[0],pb[1],heights?.[1] ?? pb[2]];
    const wall = stage === 'shell' ? undefined : streetWalls[i] ?? (stage !== 'street' ? courtyardWalls[i] : undefined) ?? (stage === 'ends' || envelope ? endWalls[i] : undefined);
    part(`edge-${i}/wall`, `Edge ${i} wall`);
    if (wall) {
      addOpeningWall(a, b, wall, vertex, inset, door,
        (id, name) => part(`edge-${i}/${id}`, `Edge ${i} ${name}`),
        facade ? o => {
          const detailPart = (id: string, name: string) => part(`edge-${i}/${id}`, `Edge ${i} ${name}`);
          addJoinery(o, i, emit(whites, 5), emit(browns, 6), emit(irons, 7), detailPart, ornament, courtyard, complete);
          if (finished) addMouldings(o, i, trimVertex, detailPart, ornament, complete);
          if (access) addEntranceFrame(o, door, detailPart);
          if (complete) finishOpening(o, i, trimVertex, emit(metals,3), door, detailPart);
          if (courtyard) addCourtyardDetail(o, i, trimVertex, emit(irons, 7), detailPart);
          if (ornament) {addBalconyOrnament(o, i, trimVertex, emit(irons, 7), detailPart, levels); addWindowPanel(o, i, trimVertex, detailPart, false, complete);}
        } : undefined, ornament, levels, courtyard, roofShape.breaks?.[i]);
      continue;
    }
    const footA: SurveyPoint = [a[0], a[1], baseElevation];
    const footB: SurveyPoint = [b[0], b[1], baseElevation];
    [footA, a, b, footA, b, footB].forEach(vertex);
  }
  if (vented) addVentedRoof(vertex, inset, part, roofShape);
  else {
    const anchors = [...eaves, ...ridges];
    for (const [index, plane] of roofPlanes.entries()) {
      part(`roof-${index}`, `Roof plane ${index + 1}`);
      const corners = plane.map(i => anchors[i]);
      const outline = corners.map(([x, z]) => new THREE.Vector2(x, -z));
      for (const triangle of THREE.ShapeUtils.triangulateShape(outline, [])) {
        triangle.forEach(i => vertex(corners[i]));
      }
    }
  }

  const outerEaves:SurveyPoint[]=roofShape.eaves.map((p,i)=>complete && (i<3||i>5) ? [p[0]+(p[0]-walls[i][0])*.9,p[1]+(p[1]-walls[i][1])*.9,p[2]] : p);
  if (envelope) addCornice(walls, vertex, part, outerEaves, roofShape.edgeHeights, complete, roofShape.breaks);
  if(complete)for(let i=0;i<8;i++) {
    const j=(i+1)%8,heights=roofShape.edgeHeights?.[i],at=(p:SurveyPoint,h:number):SurveyPoint=>[p[0],p[1],h];
    const sections=[0,...(roofShape.breaks?.[i]??[]).map(p=>p[0]),1];
    const mix=(a:SurveyPoint,b:SurveyPoint,t:number):SurveyPoint=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,eaveHeight(roofShape,i,t)];
    part('roof-overhang-'+i,'Edge '+i+' projecting roof border');
    for(let k=1;k<sections.length;k++){const u=sections[k-1],v=sections[k],a=mix(roofShape.eaves[i],roofShape.eaves[j],u),b=mix(roofShape.eaves[i],roofShape.eaves[j],v),c=mix(outerEaves[i],outerEaves[j],u),d=mix(outerEaves[i],outerEaves[j],v);[a,b,d,a,d,c].forEach(roofVertex);}
  }
  if (roofShape.returns) {
    const anchors = [...roofShape.eaves,...ridges,...(roofShape.extra ?? [])];
    for (const [i,face] of roofShape.returns.entries()) {
      part('recess-roof-return-'+i,'Recessed roof plaster return');
      face.forEach(index => wallVertex(anchors[index]));
    }
  }

  if (detailed) addChimneys(complete ? emit(metals,3) : vertex, emit(metals, 3), emit(flues, 4), part, roofShape, complete);

  if (finished) for (const corner of complete ? quoinCorners : [0]) addCornerRustication(trimVertex, part, corner);
  if (access) addDownpipes(emit(metals, 3), part, levels?.plinth, roofShape.eaves, complete ? streetDownpipes : downpipes);

  if (courtyard) addCourtyardCornice(trimVertex, part, roofShape.eaves, roofShape.edgeHeights, roofShape.breaks);
  if (ornament) addPlinth(emit(plinth, 10), emit(brick, 11), trimVertex, part, levels?.plinth, complete ? 14.72 : undefined);

  if (complete) {sheetLaps([...roofFinish],building.c,roofVertex,part);finishRoof(roofShape,roofVertex,emit(metals,3),emit(irons,7),part,outerEaves);addressPlaques(trimVertex,emit(irons,7),part);}
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions.concat(infills, doors, metals, flues, whites, browns, irons, roofFinish, trimFinish, plinth, brick), 3));
  geometry.computeVertexNormals();
  if (ornament) roofUV(geometry);
  const material = new THREE.MeshStandardMaterial({color: finished ? '#d5d0c7' : '#c5c7be', roughness: 1});
  const materials = [material];
  geometry.addGroup(0, positions.length / 3, 0);
  if (infills.length) {
    materials.push(new THREE.MeshStandardMaterial({color: '#849396', roughness: .85}));
    geometry.addGroup(positions.length / 3, infills.length / 3, 1);
  }
  if (doors.length) {
    materials.push(new THREE.MeshStandardMaterial({color: '#665d53', roughness: 1}));
    geometry.addGroup((positions.length + infills.length) / 3, doors.length / 3, 2);
  }
  if (metals.length) {
    materials.push(new THREE.MeshStandardMaterial({color: '#9a9f9b', roughness: .8}));
    geometry.addGroup((positions.length + infills.length + doors.length) / 3, metals.length / 3, 3);
    materials.push(new THREE.MeshStandardMaterial({color: '#424844', roughness: 1}));
    geometry.addGroup((positions.length + infills.length + doors.length + metals.length) / 3, flues.length / 3, 4);
  }
  if (facade) {
    let offset = (positions.length + infills.length + doors.length + metals.length + flues.length) / 3;
    for (const [data, color] of [[whites, '#e1dfd5'], [browns, '#51473f'], [irons, '#424840']] as const) {
      const index = materials.length;
      materials.push(new THREE.MeshStandardMaterial({color, roughness: .85}));
      geometry.addGroup(offset, data.length / 3, index);
      offset += data.length / 3;
    }
  }
  if (finished) {
    const offset = (positions.length + infills.length + doors.length + metals.length + flues.length + whites.length + browns.length + irons.length) / 3;
    materials.push(new THREE.MeshStandardMaterial({color: complete ? '#676c64' : ornament ? '#8e9189' : '#929c9f', roughness: ornament ? .98 : .72, metalness: ornament ? 0 : .15, normalMap: roofNormal ?? null}));
    materials.push(new THREE.MeshStandardMaterial({color: '#e3ded3', roughness: .95}));
    geometry.addGroup(offset, roofFinish.length / 3, 8);
    geometry.addGroup(offset + roofFinish.length / 3, trimFinish.length / 3, 9);
  }
  if (ornament) {
    const offset = geometry.attributes.position.count - (plinth.length + brick.length) / 3;
    materials.push(new THREE.MeshStandardMaterial({color: '#8e8980', roughness: 1}));
    materials.push(new THREE.MeshStandardMaterial({color: '#a17c68', roughness: 1}));
    geometry.addGroup(offset, plinth.length / 3, 10);
    geometry.addGroup(offset + plinth.length / 3, brick.length / 3, 11);
  }
  const root = scene.userData.keepParts ? new THREE.Group() : new THREE.Mesh(geometry, materials);
  const ownedGeometry = [geometry], ownedMaterials = [...materials];
  if (scene.userData.keepParts) {
    for (const [id, data] of parts) {
      if (!data.positions.length) continue;
      const shape = new THREE.BufferGeometry();
      shape.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
      shape.computeVertexNormals();
      if (ornament) roofUV(shape);
      const finish = materials[data.material].clone();
      finish.name = data.name;
      const mesh = new THREE.Mesh(shape, finish);
      mesh.name = data.name;
      mesh.userData.id = id;
      mesh.castShadow = mesh.receiveShadow = true;
      root.add(mesh);
      ownedGeometry.push(shape); ownedMaterials.push(finish);
    }
  }
  const signs = complete ? makeAddressSigns(building.c) : undefined;
  if(signs) root.add(...signs.meshes);
  const surfaceControl = complete ? finishMaterials(ownedMaterials, wearUniforms(building.c)) : undefined;
  root.name = 'kesk13-' + stage;
  root.position.set(building.c[0] - frame.origin[0], baseElevation - frame.base, building.c[1] - frame.origin[1]);
  root.castShadow = root.receiveShadow = true;
  return {root, shadowDetail: complete ? {radius: 35, normalBias: .02} : undefined, setTextures(enabled: boolean) {surfaceControl?.setTextures(enabled); for(const material of ownedMaterials) if(material.normalMap) material.normalScale.setScalar(enabled ? 1 : 0);}, dispose() {signs?.dispose(); roofNormal?.dispose(); root.removeFromParent(); ownedGeometry.forEach(g => g.dispose()); ownedMaterials.forEach(m => m.dispose());}};
}
