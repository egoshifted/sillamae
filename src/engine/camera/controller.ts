import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {fitCameraDepth} from './depth.ts';
import {MAX_ELEVATION, MIN_ELEVATION, orbitOffset, orbitStep, unwrapAngle, type Orbit} from './orbit.ts';

const TURN_MS = 500;
const SPIN_RATE = Math.PI / 4 / (TURN_MS / 1000), TILT_RATE = Math.PI / 12 / (TURN_MS / 1000);

export interface SavedView {
  x: number;
  y: number;
  z: number;
  span: number;
  zoom: number;
  heading: number;
  elevation: number;
}

export interface CameraView {
  offset: [number, number, number];
  span: number;
}

interface Turn {
  from: Orbit;
  to: Orbit;
  start: number;
  currentTheta?: number;
}

export class CameraController {
  readonly ortho = new THREE.OrthographicCamera();
  readonly #controls: OrbitControls;
  #span = 108; // visible metres, top to bottom, at zoom 1
  #aspect = 1;
  #turn: Turn | null = null;
  #spin = {horizontal: 0, vertical: 0};
  #last = 0;
  readonly #interactListeners = new Set<() => void>();

  constructor(dom: HTMLElement, onChange: () => void) {
    const controls = this.#controls = new OrbitControls(this.ortho, dom);
    controls.enableRotate = false;
    controls.mouseButtons = {LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN};
    controls.touches = {ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN};
    controls.screenSpacePanning = false;
    controls.enableDamping = true;
    controls.dampingFactor = .09;
    controls.minZoom = .04;
    controls.maxZoom = 12;
    controls.maxPolarAngle = Math.PI / 2 - MIN_ELEVATION;
    controls.minPolarAngle = 0;
    controls.addEventListener('change', onChange);
    controls.addEventListener('start', () => { this.#turn = null; this.#interacted(); });
  }

  get target() {
    return this.#controls.target;
  }

  get pixelsPerMetre() {
    return innerHeight * this.ortho.zoom / this.#span;
  }

  get tilt() {
    const elevation = (this.#turn?.to ?? this.#orbit()).elevation;
    return {canRaise: elevation < MAX_ELEVATION - 2e-6, canLower: elevation > MIN_ELEVATION + 1e-6};
  }

  get visibleRadius() {
    const o = this.ortho, vertical = Math.max(.01, Math.abs(o.position.clone().sub(this.#controls.target).normalize().y));
    return Math.hypot((o.right - o.left) / (2 * o.zoom), (o.top - o.bottom) / (2 * o.zoom) / vertical);
  }

  get angles() {
    const {theta, elevation} = this.#orbit(), degrees = 180 / Math.PI;
    return {heading: ((theta * degrees) % 360 + 360) % 360, elevation: elevation * degrees};
  }

  onInteract(listener: () => void) {
    this.#interactListeners.add(listener);
    return () => { this.#interactListeners.delete(listener); };
  }

  #interacted() {
    for (const listener of this.#interactListeners) listener();
  }

  // Enough to put the camera back: target, visible span and zoom, angles in degrees.
  get view(): SavedView {
    const t = this.#controls.target, {heading, elevation} = this.angles;
    return {x: t.x, y: t.y, z: t.z, span: this.#span, zoom: this.ortho.zoom, heading, elevation};
  }

  set view(v: SavedView) {
    const radian = Math.PI / 180, radius = this.ortho.position.distanceTo(this.#controls.target);
    this.#turn = null;
    this.#controls.target.set(v.x, v.y, v.z);
    this.ortho.position.copy(this.#controls.target).add(new THREE.Vector3(...orbitOffset({theta: v.heading * radian, elevation: v.elevation * radian, radius})));
    this.#span = v.span;
    this.ortho.zoom = Math.max(this.#controls.minZoom, Math.min(this.#controls.maxZoom, v.zoom));
    this.#updateFrustum();
    this.#controls.update();
  }

  setAspect(aspect: number) {
    this.#aspect = aspect;
    this.#updateFrustum();
  }

  focus(target: THREE.Vector3, view: CameraView) {
    this.#turn = null;
    this.#controls.target.copy(target);
    this.ortho.position.copy(target).add(new THREE.Vector3(...view.offset));
    this.#span = view.span;
    this.ortho.zoom = 1;
    this.#updateFrustum();
    this.#controls.update();
  }

  // Steps requested mid-turn add up from the turn's destination.
  turn(horizontal = 0, vertical = 0) {
    const from = this.#orbit(), to = orbitStep(this.#turn?.to ?? from, horizontal, vertical);
    this.#turn = {from, to, start: performance.now()};
  }

  spin(horizontal: number, vertical: number) {
    this.#spin = {horizontal, vertical};
    if (!horizontal && !vertical) return;
    this.#turn = null;
    this.#interacted();
  }

  update(now: number) {
    const spinning = this.#spinStep(Math.min(.1, (now - this.#last) / 1000));
    this.#last = now;
    const turn = this.#turn;
    if (turn) {
      const k = Math.min(1, (now - turn.start) / TURN_MS), u = k * k * (3 - 2 * k), {from, to} = turn;
      const orbit = {theta: from.theta + (to.theta - from.theta) * u, elevation: from.elevation + (to.elevation - from.elevation) * u, radius: from.radius + (to.radius - from.radius) * u};
      turn.currentTheta = orbit.theta;
      this.ortho.position.copy(this.#controls.target).add(new THREE.Vector3(...orbitOffset(orbit)));
      if (k === 1) this.#turn = null;
    }
    this.#controls.update();
    return !!turn || spinning;
  }

  prepareRender() {
    fitCameraDepth(this.ortho, this.#controls.target);
  }

  ray(clientX: number, clientY: number) {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(clientX / innerWidth * 2 - 1, 1 - clientY / innerHeight * 2), this.ortho);
    return raycaster.ray;
  }

  #spinStep(seconds: number) {
    const {horizontal, vertical} = this.#spin;
    if (!horizontal && !vertical) return false;
    const orbit = this.#orbit();
    orbit.theta += horizontal * SPIN_RATE * seconds;
    orbit.elevation = Math.max(MIN_ELEVATION, Math.min(MAX_ELEVATION, orbit.elevation + vertical * TILT_RATE * seconds));
    this.ortho.position.copy(this.#controls.target).add(new THREE.Vector3(...orbitOffset(orbit)));
    return true;
  }

  #updateFrustum() {
    const camera = this.ortho, a = this.#aspect, span = this.#span;
    camera.left = -span * a / 2;
    camera.right = span * a / 2;
    camera.top = span / 2;
    camera.bottom = -span / 2;
    camera.near = .1;
    camera.far = 15000;
    camera.updateProjectionMatrix();
  }

  #orbit(): Orbit {
    const v = this.ortho.position.clone().sub(this.#controls.target);
    return {theta: unwrapAngle(Math.atan2(v.x, v.z), this.#turn?.currentTheta ?? this.#turn?.from.theta), elevation: Math.atan2(v.y, Math.hypot(v.x, v.z)), radius: v.length()};
  }
}
