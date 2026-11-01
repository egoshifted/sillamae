import * as THREE from 'three';
import {CameraController, type CameraView} from './camera/controller.ts';
import {WorldClock} from './clock.ts';
import {clippingPlanes, extentEdges, insideExtent} from './extent.ts';
import {addSun} from './lighting/sun.ts';
import {tileBounds, type NavData, type SurveyBucket, type SurveyManifest, type WorldData, type Zone} from './data.ts';
import {navOverlay} from './nav-overlay.ts';
import {createOutline} from './outline.ts';
import {buildingPrisms, pickPrism} from './picking.ts';
import {addSurveyLayer, DETAIL_NAMES, surveyMaterials} from './survey/layer.ts';
import type {Building, BuildingOverride, BuiltOverride, CityDefinition, Point2, WorldFrame} from './types.ts';
import {addRoads} from './roads.ts';
import {addStairs} from './stairs.ts';
import {addTrees} from './vegetation/trees.ts';

const DEFAULT_VIEW: CameraView = {offset: [-110, 110, 130], span: 120};
const OUTSKIRTS = new THREE.Color('#8a8f86');
const MODEL_GLOW = .45;

export interface World {
  data: WorldData;
  survey: SurveyManifest;
  city: CityDefinition;
}

export class Engine {
  readonly frame: WorldFrame;
  readonly buildings: Building[];
  readonly clock = new WorldClock(0);
  readonly camera: CameraController;
  focusedId = '';
  continuous = false;

  readonly #renderer: THREE.WebGLRenderer;
  readonly #scene = new THREE.Scene();
  readonly #overrides = new Map<string, BuildingOverride>();
  readonly #built = new Map<string, BuiltOverride>();
  readonly #setSurveyTextures: (enabled: boolean) => void;
  readonly #survey: ReturnType<typeof addSurveyLayer>;
  readonly #forest: ReturnType<typeof addTrees>;
  readonly #vegetation = new THREE.Group();
  readonly #sun: ReturnType<typeof addSun>;
  readonly #shadowAnchors: THREE.Vector3[] = [];
  readonly #prisms: ReturnType<typeof buildingPrisms>;
  #highlighted: Building | null = null;
  #selected: Building | null = null;
  readonly #selectListeners = new Set<(building: Building | null) => void>();
  readonly #outline: ReturnType<typeof createOutline>;
  readonly #city: CityDefinition;
  #zonesVisible = false;
  readonly #tintBytes: Uint8Array;
  readonly #emissive = new Map<THREE.MeshStandardMaterial, THREE.Color>();
  #redraw = true;
  readonly #data: WorldData;
  #nav: THREE.Object3D | null = null;
  #level = -1;
  readonly #frameListeners = new Set<() => void>();
  readonly #detailListeners = new Set<(name: string) => void>();
  readonly #stats = {frames: 0, renders: 0, renderMs: 0, draws: 0, triangles: 0};

  constructor(container: HTMLElement, {data, survey, city}: World) {
    this.frame = {origin: city.frame.origin, base: data.base};
    const edges = city.extent && extentEdges(city.extent), within = (p: Point2) => !edges || insideExtent(edges, ...p);
    this.buildings = data.buildings.filter(b => within(b.c));
    this.#data = data;
    this.#city = city;
    for (const o of city.overrides) this.#overrides.set(o.id, o);
    const [ox, oz] = this.frame.origin;

    this.#scene.background = new THREE.Color('#e0e6d9');

    const renderer = this.#renderer = new THREE.WebGLRenderer({antialias: true, powerPreference: 'high-performance'});
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
    renderer.setSize(innerWidth, innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.append(renderer.domElement);

    this.camera = new CameraController(renderer.domElement, () => this.#redraw = true);
    addEventListener('resize', () => { this.#resize(); this.#redraw = true; });
    this.#resize();

    this.#sun = addSun(this.#scene, renderer, this.clock.daylight);
    if (city.extent) renderer.clippingPlanes = clippingPlanes(city.extent.map(([x, z]): Point2 => [x - ox, z - oz]));
    this.clock.onChange(k => { this.#sun.setDaylight(k); this.#redraw = true; });

    const buildingNumbers = Math.max(...data.buildings.map(b => b.pick)) + 1;
    this.#tintBytes = new Uint8Array(buildingNumbers * 4);
    const materials = surveyMaterials(renderer.capabilities.getMaxAnisotropy(), buildingNumbers, data.base);
    this.#setSurveyTextures = materials.setTextures;

    this.#survey = addSurveyLayer(this.#scene, survey.buckets, materials);
    this.#outline = createOutline(renderer);

    this.#scene.add(this.#vegetation);
    this.#forest = addTrees(this.#vegetation, data.trees.filter(t => within(t.p)), this.frame);
    addStairs(this.#scene, data.stairs);
    addRoads(this.#scene, data.roads, renderer.capabilities.getMaxAnisotropy());

    this.#prisms = buildingPrisms(this.buildings, this.frame);
    this.focusBuilding(this.#building(city.defaultFocus));
  }

  // Slow (Kesk 1 paints its textures in JS), so callers can start downloads first.
  addRefinedBuildings() {
    const [ox, oz] = this.frame.origin, ready: Promise<unknown>[] = [];
    for (const o of this.#city.overrides) {
      const building = this.#building(o.id), ground = this.#data.siteGround[o.id];
      if (!ground) throw new Error(`No site ground for ${o.id}; rebuild the data`);
      const built = o.build({scene: this.#scene, building, terrain: this.#data.terrain, frame: this.frame, ground, changed: () => { this.#redraw = true; }});
      this.#built.set(o.id, built);
      if (built.ready) ready.push(built.ready);
      tagBuilding(built.root, building.pick);
      if (o.detailShadows) this.#shadowAnchors.push(new THREE.Vector3(building.c[0] - ox, 6, building.c[1] - oz));
    }
    return Promise.all(ready);
  }

  // Without this, the first frame blocks for over a second while ANGLE links shaders.
  async compile() {
    await Promise.all([this.#renderer.compileAsync(this.#scene, this.camera.ortho), this.#outline.compile(this.#scene, this.camera.ortho)]);
  }

  start() {
    const frame = (now: number) => {
      requestAnimationFrame(frame);
      this.#step(now);
    };
    requestAnimationFrame(frame);
  }

  get domElement() {
    return this.#renderer.domElement;
  }

  requestRedraw() {
    this.#redraw = true;
  }

  onFrame(listener: () => void) {
    this.#frameListeners.add(listener);
    return () => { this.#frameListeners.delete(listener); };
  }

  onDetailChange(listener: (name: string) => void) {
    this.#detailListeners.add(listener);
    return () => { this.#detailListeners.delete(listener); };
  }

  get detail() {
    return DETAIL_NAMES[this.#level] ?? '';
  }

  addSurvey(buckets: SurveyBucket[]) {
    for (const bucket of buckets) this.#survey.fill(bucket);
    this.#renderer.shadowMap.needsUpdate = true;
    this.#redraw = true;
  }

  tilesByDistance(survey: SurveyManifest) {
    const t = this.camera.target;
    return survey.tiles.map(name => {
      const b = tileBounds(survey, name);
      return {name, distance: Math.hypot(Math.max(b.minX - t.x, 0, t.x - b.maxX), Math.max(b.minZ - t.z, 0, t.z - b.maxZ))};
    }).sort((a, b) => a.distance - b.distance);
  }

  focusBuilding(b: Building) {
    const [ox, oz] = this.frame.origin;
    this.focusedId = b.id;
    this.camera.focus(new THREE.Vector3(b.c[0] - ox, 6, b.c[1] - oz), this.#overrides.get(b.id)?.view ?? DEFAULT_VIEW);
    this.#redraw = true;
  }

  setTextures(enabled: boolean) {
    for (const built of this.#built.values()) built.setTextures(enabled);
    this.#setSurveyTextures(enabled);
    this.#redraw = true;
  }

  setShadows(enabled: boolean) {
    this.#renderer.shadowMap.enabled = enabled;
    this.#scene.traverse(o => {
      const material = (o as THREE.Mesh).material;
      if (material) for (const m of Array.isArray(material) ? material : [material]) m.needsUpdate = true;
    });
    this.#renderer.shadowMap.needsUpdate = true;
    this.#redraw = true;
  }

  pickBuilding(clientX: number, clientY: number) {
    return pickPrism(this.camera.ray(clientX, clientY), this.#prisms);
  }

  highlight(building: Building | null) {
    if (building === this.#highlighted) return;
    this.#highlighted = building;
    this.#updateOutline();
  }

  get selected() {
    return this.#selected;
  }

  select(building: Building | null) {
    if (building === this.#selected) return;
    this.#selected = building;
    this.#updateOutline();
    for (const listener of this.#selectListeners) listener(building);
  }

  onSelect(listener: (building: Building | null) => void) {
    this.#selectListeners.add(listener);
    return () => { this.#selectListeners.delete(listener); };
  }

  #updateOutline() {
    this.#outline.set(this.#highlighted?.pick ?? -1, this.#selected?.pick ?? -1);
    this.#redraw = true;
  }

  get zonesVisible() {
    return this.#zonesVisible;
  }

  showZones(visible: boolean) {
    this.#zonesVisible = visible;
    this.#applyTints();
  }

  // Absolute metres, from the terrain model.
  get reliefRange(): [number, number] {
    const heights = this.#data.terrain.values;
    return [Math.min(...heights) / 10, Math.max(...heights) / 10];
  }

  showTrees(visible: boolean) {
    this.#vegetation.visible = visible;
    this.#renderer.shadowMap.needsUpdate = true;
    this.#redraw = true;
  }

  showRelief(visible: boolean) {
    this.#survey.setRelief(visible, ...this.reliefRange);
    this.#redraw = true;
  }

  zoneOf(building: Building): Zone | undefined {
    return building.zone === undefined ? undefined : this.#data.zones[building.zone];
  }

  #tint(b: Building): [THREE.Color, number] | null {
    const zone = this.#zonesVisible && this.zoneOf(b);
    if (zone) return [zone.kind === 'block' ? new THREE.Color().setHSL(zone.id * .618 % 1, .7, .55) : OUTSKIRTS, .6];
    return null;
  }

  #applyTints() {
    for (const [material, colour] of this.#emissive) material.emissive.copy(colour);
    this.#emissive.clear();
    const bytes = this.#tintBytes.fill(0);
    for (const b of this.buildings) {
      const tint = this.#tint(b);
      if (!tint) continue;
      const [colour, strength] = tint, model = this.#built.get(b.id);
      if (model) this.#glow(model.root, colour.clone().multiplyScalar(strength * MODEL_GLOW));
      else bytes.set([colour.r, colour.g, colour.b, strength].map(v => Math.round(v * 255)), b.pick * 4);
    }
    this.#survey.setTints(bytes);
    this.#redraw = true;
  }

  #glow(root: THREE.Object3D, colour: THREE.Color) {
    root.traverse(o => {
      const material = (o as THREE.Mesh).material;
      for (const m of Array.isArray(material) ? material : material ? [material] : []) {
        if (!(m instanceof THREE.MeshStandardMaterial) || m.userData.groundSurface || this.#emissive.has(m)) continue;
        this.#emissive.set(m, m.emissive.clone());
        m.emissive.copy(colour);
      }
    });
  }

  showNav(nav: NavData, visible: boolean) {
    if (!this.#nav && visible) this.#scene.add(this.#nav = navOverlay(nav, this.#data.terrain, this.frame));
    if (this.#nav) this.#nav.visible = visible;
    this.#redraw = true;
  }

  debugInfo() {
    const [ox, oz] = this.frame.origin, t = this.camera.target, x = t.x + ox, z = t.z + oz, m = this.#data.geo.toGrid;
    const memory = this.#renderer.info.memory;
    return {
      ...this.#stats,
      detail: this.detail,
      ppm: this.camera.pixelsPerMetre,
      zoom: this.camera.ortho.zoom,
      angles: this.camera.angles,
      target: [t.x, t.y, t.z],
      grid: [m[0] * x + m[1] * z + m[2], m[3] * x + m[4] * z + m[5]],
      shadow: this.#sun.state(),
      geometries: memory.geometries,
      textures: memory.textures,
      programs: this.#renderer.info.programs?.length ?? 0,
      pixelRatio: this.#renderer.getPixelRatio(),
    };
  }

  #building(id: string) {
    const b = this.buildings.find(b => b.id === id);
    if (!b) throw new Error(`Building ${id} is not in the scene data`);
    return b;
  }

  #resize() {
    this.camera.setAspect(innerWidth / innerHeight);
    this.#renderer.setSize(innerWidth, innerHeight);
  }

  #step(now: number) {
    const turning = this.camera.update(now);
    for (const listener of this.#frameListeners) listener();
    this.#stats.frames++;
    if (!this.#redraw && !turning && !this.continuous) return;
    const ppm = this.camera.pixelsPerMetre;
    const level = ppm > 5 ? 2 : ppm > 1.8 ? 1 : 0;
    this.#level = level;
    if (this.#survey.setLevel(level)) {
      this.#renderer.shadowMap.needsUpdate = true;
      for (const listener of this.#detailListeners) listener(DETAIL_NAMES[level]);
    }
    const camera = this.camera.ortho, target = this.camera.target;
    if (this.#forest.update(target, ppm)) this.#renderer.shadowMap.needsUpdate = true;
    this.#sun.follow(camera, target, this.#shadowAnchors);
    this.camera.prepareRender();
    const started = performance.now();
    this.#renderer.render(this.#scene, camera);
    const stats = this.#stats, info = this.#renderer.info.render;
    stats.draws = info.calls; // the main pass only; the outline pass resets these
    stats.triangles = info.triangles;
    this.#outline.draw(this.#scene, camera, this.#nav ? [this.#nav] : []);
    stats.renderMs = performance.now() - started; // CPU submit time; the GPU runs asynchronously
    stats.renders++;
    this.#redraw = false;
  }
}

function tagBuilding(root: THREE.Object3D, pick: number) {
  root.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || (mesh.material as THREE.Material).userData.groundSurface) return;
    const count = mesh.geometry.attributes.position.count;
    mesh.geometry.setAttribute('building', new THREE.BufferAttribute(new Uint16Array(count).fill(pick), 1));
  });
}
