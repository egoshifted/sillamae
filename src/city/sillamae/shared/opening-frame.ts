type FrameOpening = {kind: 'window' | 'stair'; edge: number; x: number; y: number; w: number; h: number};
export type FrameMaterial = 'frame' | 'reveal' | 'sill';
type Solid = (edge: number, x: number, y: number, width: number, height: number, offset: number, depth: number, material: FrameMaterial, name: string) => void;

export function frameOpening(o: FrameOpening, solid: Solid, mullions: readonly number[], transomPitch = 1.2) {
  const fw = o.kind === 'stair' ? .065 : .055, r = .025;
  const x = o.x + r, y = o.y + r, w = o.w - 2*r, h = o.h - 2*r;
  const name = 'detail-' + o.kind;
  for (const side of [o.x, o.x + o.w - r]) solid(o.edge, side, o.y, r, o.h, -.11, .22, 'reveal', name + '-reveal');
  for (const end of [o.y, o.y + o.h - r]) solid(o.edge, x, end, w, r, -.11, .22, 'reveal', name + '-reveal');
  for (const side of [x, x + w - fw]) solid(o.edge, side, y, fw, h, -.16, .04, 'frame', name + '-frame');
  for (const end of [y, y + h - fw]) solid(o.edge, x + fw, end, w - 2*fw, fw, -.16, .04, 'frame', name + '-frame');
  if (o.kind === 'window') {
    for (const f of mullions) solid(o.edge, x + w*f - fw/2, y, fw, h, -.16, .04, 'frame', 'detail-window-mullion');
    solid(o.edge, o.x - .04, o.y - .065, o.w + .08, .065, .025, .05, 'sill', 'detail-window-sill');
  } else {
    for (let bar = y + transomPitch; bar < y + h - .2; bar += transomPitch)
      solid(o.edge, x + fw, bar, w - 2*fw, fw, -.16, .04, 'frame', 'detail-stair-transom');
  }
}
