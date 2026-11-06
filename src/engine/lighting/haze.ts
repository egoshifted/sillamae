import * as THREE from 'three';

// Visible metres, top to bottom, between which the air thickens. An orthographic
// view has no distance of its own, so the view's scale stands in for altitude.
const CLOSE = 140, FAR = 2400;
// Share of haze at the view's centre and at its far edge.
const CENTRE = {close: 0, far: .2}, EDGE = {close: .05, far: .46};

const EDGE_FADE = 420; // metres inside the map's edge over which it dissolves into the sky
const SKY_TOP = [.8, .9, 1.03], SKY_FROM = -.3; // tint at the top of the screen, and where it starts (-1 to 1)
const CLOUD = {near: 200, far: 900, size: 640, shade: .68}; // visible metres; metres; share of sun lost

const undoSmoothstep = (y: number) => .5 - Math.sin(Math.asin(1 - 2 * y) / 3);

// Places THREE.Fog's smoothstep to give those shares at the current view. Call once
// fitCameraDepth has placed the camera: fog is measured from it, and it moves with zoom.
export function fitHaze(fog: THREE.Fog, camera: THREE.OrthographicCamera, target: THREE.Vector3) {
  const offset = camera.position.clone().sub(target), distance = offset.length();
  const vertical = Math.max(.01, Math.abs(offset.y) / distance), horizontal = Math.sqrt(1 - vertical * vertical);
  // Held at close-up scale: fitted to a view metres tall, the ground a few metres off the
  // target's plane would fall past the far edge and turn solid haze at full zoom.
  const halfView = Math.max((camera.top - camera.bottom) / (2 * camera.zoom), CLOSE / 2);
  const altitude = THREE.MathUtils.smoothstep(Math.log(halfView * 2), Math.log(CLOSE), Math.log(FAR));
  const atCentre = undoSmoothstep(Math.max(1e-4, THREE.MathUtils.lerp(CENTRE.close, CENTRE.far, altitude)));
  const atEdge = undoSmoothstep(THREE.MathUtils.lerp(EDGE.close, EDGE.far, altitude));
  // Looking straight down the far edge is no further away, but the fit still needs a span.
  const depth = Math.max(halfView * horizontal / vertical, halfView * .5), range = depth / (atEdge - atCentre);
  fog.near = distance - atCentre * range;
  fog.far = fog.near + range;
}

const VERTEX = `
vHaze = vec4(transpose(mat3(viewMatrix)) * (mvPosition.xyz - viewMatrix[3].xyz), gl_Position.y / gl_Position.w);
vHazeSpan = 2. / projectionMatrix[1][1];
`;

const glsl = (v: number) => v.toFixed(6);

const fragmentFunctions = (edges: THREE.Vector3[]) => `
varying vec4 vHaze; // world position, then screen height from -1 to 1
varying float vHazeSpan; // visible metres, top to bottom
float hazeHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hazeNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f);
  return mix(mix(hazeHash(i), hazeHash(i + vec2(1, 0)), u.x), mix(hazeHash(i + vec2(0, 1)), hazeHash(i + vec2(1, 1)), u.x), u.y);
}
// Close up one cloud would dim the whole view, and it would read as a change of light.
float hazeCloud() {
  float strength = smoothstep(${glsl(CLOUD.near)}, ${glsl(CLOUD.far)}, vHazeSpan);
  if (strength <= 0.) return 1.;
  vec2 p = vHaze.xz / ${glsl(CLOUD.size)};
  float n = hazeNoise(p) * .55 + hazeNoise(p * 2.1 + 3.7) * .3 + hazeNoise(p * 4.7 + 1.3) * .15;
  return 1. - ${glsl(CLOUD.shade)} * strength * smoothstep(.47, .62, n);
}
float hazeEdge() {
  float inside = ${glsl(EDGE_FADE)};
  ${edges.map(e => `inside = min(inside, ${glsl(e.x)} * vHaze.x + ${glsl(e.y)} * vHaze.z + ${glsl(e.z)});`).join('\n  ')}
  return 1. - smoothstep(0., ${glsl(EDGE_FADE)}, inside);
}
vec3 hazeSky() {
  return fogColor * mix(vec3(1.), vec3(${SKY_TOP.map(glsl).join(', ')}), smoothstep(${glsl(SKY_FROM)}, 1., vHaze.w));
}
`;

function extend(chunk: string, anchor: string, replacement: string) {
  // A three.js upgrade that moves the anchor must fail loudly, not lose the atmosphere.
  if (!chunk.includes(anchor)) throw Error('three.js shader chunk changed: ' + anchor);
  return chunk.replace(anchor, replacement);
}

// Only materials drawn with scene.fog pay for or show any of this, so one call changes
// the atlas and leaves the studio alone. Runs before any program links. edges: extentEdges.
export function installAtmosphere(edges: THREE.Vector3[]) {
  const chunks = THREE.ShaderChunk as unknown as Record<string, string>;
  chunks.fog_pars_vertex = extend(chunks.fog_pars_vertex, 'varying float vFogDepth;', 'varying float vFogDepth;\nvarying vec4 vHaze;\nvarying float vHazeSpan;');
  chunks.fog_vertex = extend(chunks.fog_vertex, 'vFogDepth = - mvPosition.z;', 'vFogDepth = - mvPosition.z;' + VERTEX);
  chunks.fog_pars_fragment = extend(chunks.fog_pars_fragment, 'varying float vFogDepth;', 'varying float vFogDepth;' + fragmentFunctions(edges));
  chunks.fog_fragment = extend(chunks.fog_fragment, 'gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );', 'gl_FragColor.rgb = mix(gl_FragColor.rgb, hazeSky(), 1. - (1. - fogFactor) * (1. - hazeEdge()));');
  chunks.lights_fragment_begin = extend(chunks.lights_fragment_begin, 'getDirectionalLightInfo( directionalLight, directLight );', 'getDirectionalLightInfo( directionalLight, directLight );\n#ifdef USE_FOG\ndirectLight.color *= hazeCloud();\n#endif');
}

// The screen-space gradient behind the map; hazeSky() must stay the same colour.
export function skyBackground() {
  const rows = 64, bytes = new Uint8Array(rows * 4), rgb = {r: 0, g: 0, b: 0};
  const texture = new THREE.DataTexture(bytes, 1, rows);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  return {
    texture,
    paint(air: THREE.Color) {
      air.getRGB(rgb, THREE.SRGBColorSpace);
      for (let row = 0; row < rows; row++) {
        const k = THREE.MathUtils.smoothstep(row / (rows - 1) * 2 - 1, SKY_FROM, 1);
        [rgb.r, rgb.g, rgb.b].forEach((c, i) => { bytes[row * 4 + i] = Math.round(255 * Math.min(1, c * (1 + (SKY_TOP[i] - 1) * k))); });
        bytes[row * 4 + 3] = 255;
      }
      texture.needsUpdate = true;
    },
  };
}
