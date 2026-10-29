import * as THREE from 'three';

const SAMPLES = 12;
const HOVER = {radius: 2}, SELECTED = {radius: 3, colour: 'vec3(1., .62, 0.)'}; // sRGB, written straight to the canvas

export function createOutline(renderer: THREE.WebGLRenderer) {
  const target = new THREE.WebGLRenderTarget(1, 1, {samples: 4});
  const hovered = {value: -1}, selected = {value: -1};
  // Red marks the hovered building, green the selected one. Geometry without
  // a building attribute reads 0, which is never a building.
  const mask = new THREE.MeshBasicMaterial({side: THREE.DoubleSide});
  mask.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, {hoveredBuilding: hovered, selectedBuilding: selected});
    shader.vertexShader = 'attribute float building;\nvarying float vBuilding;\n' +
      shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvBuilding = building;');
    shader.fragmentShader = 'uniform float hoveredBuilding;\nuniform float selectedBuilding;\nvarying float vBuilding;\n' +
      shader.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n' +
        'gl_FragColor = vec4(abs(vBuilding - hoveredBuilding) < .5 ? 1. : 0., abs(vBuilding - selectedBuilding) < .5 ? 1. : 0., 0., 1.);');
  };

  const texel = new THREE.Vector2(), step = (2 * Math.PI / SAMPLES).toFixed(6);
  const edge = new THREE.ShaderMaterial({
    uniforms: {mask: {value: target.texture}, texel: {value: texel}},
    vertexShader: 'varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: `uniform sampler2D mask;\nuniform vec2 texel;\nvarying vec2 vUv;
void main() {
  vec2 ring = vec2(0.);
  for (int i = 0; i < ${SAMPLES}; i++) {
    vec2 around = vec2(cos(float(i) * ${step}), sin(float(i) * ${step})) * texel;
    ring.x = max(ring.x, texture2D(mask, vUv + around * ${HOVER.radius}.).r);
    ring.y = max(ring.y, texture2D(mask, vUv + around * ${SELECTED.radius}.).g);
  }
  vec2 alpha = clamp(ring - texture2D(mask, vUv).rg, 0., 1.);
  if (max(alpha.x, alpha.y) <= 0.) discard;
  gl_FragColor = alpha.y >= alpha.x ? vec4(${SELECTED.colour}, alpha.y) : vec4(0., 0., 0., alpha.x);
}`,
    transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
  });
  const overlay = new THREE.Scene(), flat = new THREE.OrthographicCamera();
  overlay.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), edge));
  const size = new THREE.Vector2(), black = new THREE.Color(0);

  return {
    async compile(scene: THREE.Scene, camera: THREE.Camera) {
      const probe = new THREE.Mesh(new THREE.BufferGeometry(), mask);
      await Promise.all([renderer.compileAsync(probe, camera, scene), renderer.compileAsync(overlay, flat)]);
      probe.geometry.dispose();
    },

    // Building numbers, or -1 for none.
    set(hover: number, selection: number) {
      hovered.value = hover === selection ? -1 : hover;
      selected.value = selection;
    },

    draw(scene: THREE.Scene, camera: THREE.Camera, hidden: THREE.Object3D[]) {
      if (hovered.value < 0 && selected.value < 0) return;
      renderer.getDrawingBufferSize(size);
      if (target.width !== size.x || target.height !== size.y) target.setSize(size.x, size.y);
      texel.set(1 / size.x, 1 / size.y);
      const background = scene.background, visible = hidden.map(o => o.visible), clear = renderer.getClearColor(new THREE.Color()), alpha = renderer.getClearAlpha();
      scene.background = null;
      scene.overrideMaterial = mask;
      hidden.forEach(o => o.visible = false);
      renderer.setClearColor(black, 1);
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.setClearColor(clear, alpha);
      hidden.forEach((o, i) => o.visible = visible[i]);
      scene.overrideMaterial = null;
      scene.background = background;
      renderer.autoClear = false;
      renderer.render(overlay, flat);
      renderer.autoClear = true;
    },
  };
}
