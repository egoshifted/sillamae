import * as THREE from 'three';

const RIPPLE_SIZE = 256, WAVES = 72;
// The render layer of what the water reflects.
export const MIRRORED = 2;

// Sum of plane waves with whole wavenumbers, so the texture tiles. Mipmaps
// average the slopes away with distance, which is what keeps far water from
// sparkling on an orthographic view; no wave needs fading by hand.
function rippleTexture(anisotropy: number) {
  let seed = 41;
  const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const waves = Array.from({length: WAVES}, () => {
    const size = 2 + Math.floor(rng() ** 1.6 * 30), angle = .5 + (rng() - .5) * 2.4;
    const kx = Math.round(Math.cos(angle) * size), kz = Math.round(Math.sin(angle) * size);
    return {kx, kz, amplitude: 1 / Math.max(1, Math.hypot(kx, kz)), phase: rng() * Math.PI * 2};
  }).filter(w => w.kx || w.kz);
  const slopes = new Float32Array(RIPPLE_SIZE * RIPPLE_SIZE * 2);
  let peak = 0;
  for (let z = 0, at = 0; z < RIPPLE_SIZE; z++) for (let x = 0; x < RIPPLE_SIZE; x++, at += 2) {
    for (const w of waves) {
      const slope = w.amplitude * Math.cos((w.kx * x + w.kz * z) / RIPPLE_SIZE * Math.PI * 2 + w.phase);
      slopes[at] += slope * w.kx;
      slopes[at + 1] += slope * w.kz;
    }
    peak = Math.max(peak, Math.abs(slopes[at]), Math.abs(slopes[at + 1]));
  }
  const bytes = new Uint8Array(RIPPLE_SIZE * RIPPLE_SIZE * 4);
  for (let k = 0; k < RIPPLE_SIZE * RIPPLE_SIZE; k++) {
    bytes[k * 4] = 127.5 + 127.5 * slopes[k * 2] / peak;
    bytes[k * 4 + 1] = 127.5 + 127.5 * slopes[k * 2 + 1] / peak;
    bytes[k * 4 + 3] = 255;
  }
  const texture = new THREE.DataTexture(bytes, RIPPLE_SIZE, RIPPLE_SIZE);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = Math.min(8, anisotropy);
  texture.needsUpdate = true;
  return texture;
}

const WATER_FRAGMENT = `
uniform sampler2D waterRipples;
uniform float waterTime;
uniform vec3 skyZenith;
uniform vec3 skyHorizon;
uniform vec3 sunDirection;
uniform vec3 sunGlow;
uniform sampler2D reflectionMap;
uniform mat4 reflectionMatrix;
uniform float reflecting;
vec2 waterSlope(vec2 p, float metresPerPixel) {
  const mat2 TURN = mat2(.8, .6, -.6, .8);
  vec2 chop = texture2D(waterRipples, TURN * p / 31. + waterTime * vec2(.009, .014)).rg - .5;
  vec2 fine = texture2D(waterRipples, p / 11.3 - waterTime * vec2(.021, .011)).rg - .5;
  vec2 swell = texture2D(waterRipples, TURN * TURN * p / 173. + waterTime * vec2(.003, .002)).rg - .5;
  // A wave smaller than a few pixels only tiles and sparkles, however well its mips average.
  float near = 1. - smoothstep(.25, 1.1, metresPerPixel), middle = 1. - smoothstep(.8, 3.5, metresPerPixel);
  return chop * .17 * middle + fine * .11 * near + swell * .16 * middle;
}
float waterWind(vec2 p) {
  const mat2 TURN = mat2(.6, .8, -.8, .6);
  return texture2D(waterRipples, p / 1270., 3.5).r * .6 + texture2D(waterRipples, TURN * p / 2117., 3.5).g * .6 + texture2D(waterRipples, TURN * TURN * p / 433., 3.5).r * .3 - .25;
}
`;

// The water mesh carries how far a point lies from the shore in the sRGB red of
// its paint, up to shore.ts's SHORE_RANGE; the survey's own open water paints .5.
const WATER_COLOUR = `
float shoreDepth = clamp((pow(vColor.r, 1. / 2.2) - .1) / .4, 0., 1.);
diffuseColor.rgb = mix(vec3(.1, .17, .12), vec3(.035, .115, .135), smoothstep(.03, 1., shoreDepth));
`;

const WATER_NORMAL = `
vec2 waterGradient = waterSlope(vSurvey.xz, length(fwidth(vSurvey.xz)));
vec3 waterNormal = normalize(vec3(-waterGradient.x, 1., -waterGradient.y));
normal = normalize((viewMatrix * vec4(waterNormal, 0.)).xyz);
`;

// On an orthographic view the eye direction is one vector for the whole screen,
// so flat water would reflect a single sky colour. All variation comes from the
// normal and from broad wind patches, sampled far below the ripples' scales.
const WATER_REFLECTION = `
vec3 toEye = vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
vec3 mirrored = reflect(-toEye, waterNormal);
float wind = waterWind(vSurvey.xz);
float facing = 1. - max(dot(toEye, waterNormal), 0.);
float fresnel = .05 + .95 * facing * facing * facing;
vec3 sky = mix(skyHorizon, skyZenith, smoothstep(.02, .75, mirrored.y));
sky += sunGlow * pow(max(dot(mirrored, sunDirection), 0.), 24.);
if (reflecting > .5) {
  vec2 mirrorAt = (reflectionMatrix * vec4(vSurvey, 1.)).xy + waterGradient * vec2(.012, .05);
  vec4 scenery = texture2D(reflectionMap, mirrorAt);
  scenery.a *= step(0., mirrorAt.x) * step(mirrorAt.x, 1.) * step(0., mirrorAt.y) * step(mirrorAt.y, 1.);
  sky = mix(sky, scenery.rgb, scenery.a);
  fresnel = mix(fresnel, min(1., fresnel * 3.), scenery.a);
}
outgoingLight = mix(outgoingLight, mix(outgoingLight, sky, clamp(fresnel * (.58 + wind * .6), 0., 1.)), 1. - relief);
#include <opaque_fragment>
`;

const lerp = (from: THREE.Color, to: THREE.Color, k: number) => from.clone().lerp(to, k);
const SKY = {
  zenith: {low: new THREE.Color('#7f9fc4'), high: new THREE.Color('#5c8fce')},
  horizon: {low: new THREE.Color('#f2cfa8'), high: new THREE.Color('#cfe0ee')},
  glow: {low: new THREE.Color('#ffb070').multiplyScalar(1.6), high: new THREE.Color('#fff4e0').multiplyScalar(1.1)},
};

export function waterSurface<M extends THREE.MeshStandardMaterial>(material: M, anisotropy: number) {
  const ripples = rippleTexture(anisotropy), direction = new THREE.Vector3(.4, .8, -.2).normalize();
  const uniforms = {
    waterRipples: {value: ripples}, waterTime: {value: 0}, sunDirection: {value: direction},
    skyZenith: {value: SKY.zenith.high.clone()}, skyHorizon: {value: SKY.horizon.high.clone()}, sunGlow: {value: SKY.glow.high.clone()},
    reflectionMap: {value: null as THREE.Texture | null}, reflectionMatrix: {value: new THREE.Matrix4()}, reflecting: {value: 0},
  };
  const overlay = material.onBeforeCompile.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    overlay(shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = WATER_FRAGMENT + shader.fragmentShader
      .replace('vec4 buildingTint =', WATER_COLOUR + 'vec4 buildingTint =')
      .replace('#include <normal_fragment_maps>', WATER_NORMAL)
      .replace('#include <opaque_fragment>', WATER_REFLECTION);
  };
  material.customProgramCacheKey = () => 'survey-water';
  return {
    material, time: uniforms.waterTime, reflectionMap: uniforms.reflectionMap, reflectionMatrix: uniforms.reflectionMatrix, reflecting: uniforms.reflecting,
    // sun: unit vector towards it. Sky colours are linear, and warm with a low sun.
    setSky(sun: THREE.Vector3) {
      const height = THREE.MathUtils.smoothstep(sun.y, .45, .9);
      direction.copy(sun);
      uniforms.skyZenith.value.copy(lerp(SKY.zenith.low, SKY.zenith.high, height));
      uniforms.skyHorizon.value.copy(lerp(SKY.horizon.low, SKY.horizon.high, height));
      uniforms.sunGlow.value.copy(lerp(SKY.glow.low, SKY.glow.high, height));
    },
  };
}

export type WaterSurface = ReturnType<typeof waterSurface>;
