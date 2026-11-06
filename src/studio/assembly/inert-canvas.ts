const blankImage = (x: number, y: number, width: number, height: number) => ({data: new Uint8ClampedArray(width * height * 4)});
const blankGradient = () => ({addColorStop() {}});
const inertContext = () => new Proxy({}, {get: (target: Record<string | symbol, unknown>, key) => key === 'createImageData' ? undefined : key === 'getImageData' ? blankImage : key === 'createLinearGradient' || key === 'createRadialGradient' ? blankGradient : key in target ? target[key] : () => {}});

// Models paint procedural textures on canvases. In Node only their geometry
// matters, so canvases are inert stand-ins.
export function installInertCanvas() {
  Object.assign(globalThis, {document: {createElement: () => ({width: 0, height: 0, getContext: inertContext})}});
}
