import * as THREE from 'three';

// A ruler laid along the ground: click points, read each segment's run along the
// ground, its slope length and the height change, and the total. Not saved.
export class Measure {
  readonly group = new THREE.Group();
  readonly #points: THREE.Vector3[] = [];
  #hover: THREE.Vector3 | null = null;
  #open = true;
  readonly #line = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({color: '#e0312b', depthTest: false}));
  readonly #dots = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({color: '#e0312b', size: 7, sizeAttenuation: false, depthTest: false}));
  readonly #labels: HTMLElement;

  constructor(scene: THREE.Scene, overlay: HTMLElement) {
    this.#labels = overlay;
    this.#line.renderOrder = this.#dots.renderOrder = 999;
    this.group.add(this.#line, this.#dots);
    scene.add(this.group);
  }

  get active() { return this.#open && this.#points.length > 0; }

  add(p: THREE.Vector3) {
    if (!this.#open) this.clear();
    this.#points.push(p.clone());
    this.#rebuild();
  }

  hover(p: THREE.Vector3 | null) {
    this.#hover = p?.clone() ?? null;
    if (this.#open) this.#rebuild();
  }

  finish() {
    this.#open = false;
    this.#rebuild();
  }

  clear() {
    this.#points.length = 0;
    this.#open = true;
    this.#rebuild();
  }

  #shown() { return this.#open && this.#hover && this.#points.length ? [...this.#points, this.#hover] : this.#points; }

  #rebuild() {
    // A geometry's position buffer cannot grow, so each change gets a new one.
    const shown = this.#shown().map(p => p.clone().setY(p.y + .05));
    for (const o of [this.#line, this.#dots]) {
      o.geometry.dispose();
      o.geometry = new THREE.BufferGeometry().setFromPoints(shown);
    }
  }

  // Places the labels over the canvas; call after every render.
  labels(camera: THREE.Camera, width: number, height: number) {
    const shown = this.#shown(), parts: HTMLElement[] = [];
    const at = (p: THREE.Vector3, text: string, total = false) => {
      const v = p.clone().project(camera);
      if (v.z > 1) return;
      const label = Object.assign(document.createElement('span'), {className: total ? 'measure total' : 'measure', textContent: text});
      label.style.transform = `translate(${(v.x + 1) / 2 * width}px, ${(1 - v.y) / 2 * height}px)`;
      parts.push(label);
    };
    let run = 0, slope = 0;
    for (let i = 1; i < shown.length; i++) {
      const a = shown[i - 1], b = shown[i], flat = Math.hypot(b.x - a.x, b.z - a.z), along = a.distanceTo(b), rise = b.y - a.y;
      run += flat;
      slope += along;
      at(a.clone().lerp(b, .5), `${flat.toFixed(2)} m${Math.abs(rise) >= .01 ? ` · ${rise > 0 ? '+' : ''}${rise.toFixed(2)} m · ${(Math.atan2(rise, flat) * 180 / Math.PI).toFixed(1)}°` : ''}`);
    }
    if (shown.length > 2) at(shown[shown.length - 1], `Total ${run.toFixed(2)} m on plan, ${slope.toFixed(2)} m along the ground`, true);
    this.#labels.replaceChildren(...parts);
  }
}
