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
uniform float waterDusk;
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
// The material's broad highlight turns a sea facing a low sun into flat grey; the glint below replaces it.
outgoingLight -= reflectedLight.directSpecular * .9;
float wind = waterWind(vSurvey.xz);
float facing = 1. - max(dot(toEye, waterNormal), 0.);
float fresnel = .05 + .95 * facing * facing * facing;
vec3 sky = mix(skyHorizon, skyZenith, smoothstep(.02, .75, mirrored.y));
sky += sunGlow * pow(max(dot(mirrored, sunDirection), 0.), 110.);
#ifdef USE_FOG
// Water shows the sky far more than its own lit colour, so a cloud barely darkens it.
outgoingLight += reflectedLight.directDiffuse * (1. / hazeCloud() - 1.) * .7;
sky *= .78 + .22 * hazeCloud();
#endif
if (reflecting > .5) {
  vec2 mirrorAt = (reflectionMatrix * vec4(vSurvey, 1.)).xy + waterGradient * vec2(.012, .05);
  vec4 scenery = texture2D(reflectionMap, mirrorAt);
  scenery.a *= step(0., mirrorAt.x) * step(mirrorAt.x, 1.) * step(0., mirrorAt.y) * step(mirrorAt.y, 1.);
  sky = mix(sky, scenery.rgb, scenery.a);
  fresnel = mix(fresnel, min(1., fresnel * 3.), scenery.a);
}
outgoingLight = mix(outgoingLight, mix(outgoingLight, sky, clamp(fresnel * (.58 + wind * .6) + waterDusk, 0., 1.)), 1. - relief);
#include <opaque_fragment>
`;

const lerp = (from: THREE.Color, to: THREE.Color, k: number) => from.clone().lerp(to, k);
const DUSK_MIRROR = .24;
const SKY = {
  zenith: {dusk: new THREE.Color('#5a5c84'), low: new THREE.Color('#7f9fc4'), high: new THREE.Color('#5c8fce')},
  horizon: {dusk: new THREE.Color('#b9805f'), low: new THREE.Color('#f2cfa8'), high: new THREE.Color('#cfe0ee')},
  glow: {low: new THREE.Color('#ffb070').multiplyScalar(1.6), high: new THREE.Color('#fff4e0').multiplyScalar(1.1)},
};

// From above a pane mirrors the ground, not the sky, so the elevation is folded upward: this is
// an impression of bright sky that tracks the day, not a true reflection. Tilting each pane a
// little, as real ones sit, gives a facade uneven panes rather than one flat tone.
const GLASS_VERTEX = `varying vec3 vGlassAt;\n`, GLASS_WORLD = `vGlassAt = (modelMatrix * vec4(transformed, 1.)).xyz;\n`;
const GLASS_FRAGMENT = `
varying vec3 vGlassAt;
uniform vec3 skyZenith;
uniform vec3 skyHorizon;
uniform vec3 sunDirection;
uniform vec3 sunGlow;
`;
const GLASS_LIGHT = `
vec3 glassEye = vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
vec3 glassNormal = inverseTransformDirection(normal, viewMatrix);
if (dot(glassEye, glassNormal) < 0.) glassNormal = -glassNormal;
float glassShare = GLASS_PANES * (1. - smoothstep(.25, .5, abs(glassNormal.y)));
vec2 glassPane = floor(vec2(vGlassAt.x + vGlassAt.z, vGlassAt.y) / vec2(1.3, 1.1));
float glassTilt = fract(sin(dot(glassPane, vec2(12.9898, 78.233))) * 43758.5453);
glassNormal = normalize(glassNormal + vec3(glassTilt - .5, 0., fract(glassTilt * 7.31) - .5) * .18);
vec3 glassMirror = reflect(-glassEye, glassNormal);
glassMirror.y = abs(glassMirror.y);
// A low sun strikes upright panes square on, and would light them like walls.
float glassDay = smoothstep(.2, .55, sunDirection.y);
outgoingLight *= 1. - glassShare * .6 * (1. - glassDay);
vec3 glassSky = mix(skyHorizon, skyZenith, smoothstep(.05, .7, glassMirror.y)) * (.38 + .16 * glassTilt) * (.55 + .45 * glassDay);
glassSky += sunGlow * pow(max(dot(glassMirror, sunDirection), 0.), 48.) * (.3 + .7 * glassDay);
float glassFacing = 1. - max(dot(glassEye, glassNormal), 0.);
outgoingLight = mix(outgoingLight, glassSky, glassShare * (.14 + .4 * glassFacing * glassFacing));
#include <opaque_fragment>
`;
// Survey "glass" is any blue-tinged building paint, walls and roofs included. Real panes are one
// narrow family of colours, the great bulk of its area, so paint selects them. Linear colour.
const SURVEY_PANES = 'smoothstep(1.35, 1.5, vColor.g / max(vColor.r, 1e-3)) * (1. - smoothstep(1.85, 2.05, vColor.g / max(vColor.r, 1e-3))) * (1. - smoothstep(1.2, 1.3, vColor.b / max(vColor.g, 1e-3)))';

// The blue-grey every refined model paints its panes. Models name glass inconsistently, and the
// engine must not know them, so colour is the one thing they share. Zinc roofs sit just below
// this saturation; grey steel doors do not, and take a little sky too.
export function looksLikeGlass(material: THREE.Material) {
  if (!(material instanceof THREE.MeshStandardMaterial) || material.map || material.metalness > .2) return false;
  const {h, s, l} = material.color.getHSL({h: 0, s: 0, l: 0}, THREE.SRGBColorSpace);
  return h > .48 && h < .6 && s > .07 && s < .25 && l > .33 && l < .78;
}

export function waterSurface<M extends THREE.MeshStandardMaterial>(material: M, anisotropy: number) {
  const ripples = rippleTexture(anisotropy), direction = new THREE.Vector3(.4, .8, -.2).normalize();
  const uniforms = {
    waterRipples: {value: ripples}, waterTime: {value: 0}, sunDirection: {value: direction},
    skyZenith: {value: SKY.zenith.high.clone()}, skyHorizon: {value: SKY.horizon.high.clone()}, sunGlow: {value: SKY.glow.high.clone()},
    reflectionMap: {value: null as THREE.Texture | null}, reflectionMatrix: {value: new THREE.Matrix4()}, reflecting: {value: 0},
    waterDusk: {value: 0},
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
    // Shares the water's sky, so glass follows the sunlight setting.
    glaze(glass: THREE.MeshStandardMaterial, survey = false) {
      const before = glass.onBeforeCompile.bind(glass), key = glass.customProgramCacheKey();
      glass.onBeforeCompile = (shader, renderer) => {
        before(shader, renderer);
        Object.assign(shader.uniforms, {skyZenith: uniforms.skyZenith, skyHorizon: uniforms.skyHorizon, sunDirection: uniforms.sunDirection, sunGlow: uniforms.sunGlow});
        shader.vertexShader = GLASS_VERTEX + shader.vertexShader.replace('#include <project_vertex>', GLASS_WORLD + '#include <project_vertex>');
        shader.fragmentShader = GLASS_FRAGMENT + shader.fragmentShader.replace('#include <opaque_fragment>', GLASS_LIGHT.replace('GLASS_PANES', survey ? SURVEY_PANES : '1.'));
      };
      glass.customProgramCacheKey = () => key + (survey ? '-survey-glass' : '-sky-glass');
      glass.needsUpdate = true;
    },
    material, time: uniforms.waterTime, reflectionMap: uniforms.reflectionMap, reflectionMatrix: uniforms.reflectionMatrix, reflecting: uniforms.reflecting,
    // sun: unit vector towards it. Sky colours are linear, and warm with a low sun.
    setSky(sun: THREE.Vector3) {
      const height = THREE.MathUtils.smoothstep(sun.y, .2, .62), dusk = 1 - THREE.MathUtils.smoothstep(sun.y, .07, .3);
      direction.copy(sun);
      uniforms.skyZenith.value.copy(lerp(SKY.zenith.low, SKY.zenith.high, height)).lerp(SKY.zenith.dusk, dusk);
      uniforms.skyHorizon.value.copy(lerp(SKY.horizon.low, SKY.horizon.high, height)).lerp(SKY.horizon.dusk, dusk);
      // The atlas looks steeply down, where water mirrors little; at sunset its colour comes from the sky anyway.
      uniforms.waterDusk.value = dusk * DUSK_MIRROR;
      uniforms.sunGlow.value.copy(lerp(SKY.glow.low, SKY.glow.high, height));
    },
  };
}

export type WaterSurface = ReturnType<typeof waterSurface>;
