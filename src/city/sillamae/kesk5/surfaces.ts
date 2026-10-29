import * as THREE from 'three';

interface Surfaces {masonry: THREE.Texture[]; roof: THREE.Texture[]; ready: Promise<void[]>}
let loaded: Surfaces | undefined;
export function surfaces(): Surfaces {
  if (loaded) return loaded;
  const pending: Promise<void>[] = [], loader = typeof window === 'undefined' ? null : new THREE.TextureLoader();
  function texture(url: URL, colour: boolean) {
    const canvas = loader ? document.createElement('canvas') : null;
    if (canvas) { canvas.width = canvas.height = 1; const ctx = canvas.getContext('2d')!; ctx.fillStyle = colour ? '#c0c0c0' : '#808080'; ctx.fillRect(0, 0, 1, 1); }
    const t = canvas ? new THREE.CanvasTexture(canvas) : new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1);
    if (loader) pending.push(loader.loadAsync(url.href).then(image => { t.image = image.image; t.needsUpdate = true; image.dispose(); }).catch(() => console.warn('Kesk 5 is using a plain surface because a texture could not load: ' + url.pathname)));
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.flipY = false;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.anisotropy = 8;
    if (colour) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const masonry = [texture(new URL('./textures/masonry-v1-0.png', import.meta.url), true), texture(new URL('./textures/masonry-v1-1.png', import.meta.url), false)];
  const roof = [texture(new URL('./textures/felt-colour-v1-0.png', import.meta.url), true), texture(new URL('./textures/felt-relief-v1-0.png', import.meta.url), false)];
  return loaded = {masonry, roof, ready: Promise.all(pending)};
}

export const preloadSurfaces = () => surfaces().ready;
