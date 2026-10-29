import {useEffect, useState} from 'react';
import type {Engine} from '../engine/engine.ts';

export function HoverLabel({engine}: {engine: Engine}) {
  const [label, setLabel] = useState<{text: string; left: number; top: number} | null>(null);

  useEffect(() => {
    const canvas = engine.domElement;
    let frame = 0, pointer = {x: 0, y: 0};
    const pick = () => {
      frame = 0;
      const building = engine.pickBuilding(pointer.x, pointer.y);
      engine.highlight(building);
      if (!building) return setLabel(null);
      const zone = engine.zonesVisible && engine.zoneOf(building);
      const suffix = !zone ? '' : zone.kind === 'block' ? ` · block ${zone.id} (${zone.buildings.length})` : ' · outskirts';
      setLabel({text: building.name + suffix, left: Math.min(innerWidth - 210, pointer.x + 12), top: pointer.y + 16});
    };
    const hide = () => { cancelAnimationFrame(frame); frame = 0; setLabel(null); engine.highlight(null); };
    const move = (e: PointerEvent) => {
      if (e.buttons) return hide();
      pointer = {x: e.clientX, y: e.clientY};
      frame ||= requestAnimationFrame(pick);
    };
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerleave', hide);
    const offInteract = engine.camera.onInteract(hide);
    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerleave', hide);
      offInteract();
    };
  }, [engine]);

  return <div id="tooltip" hidden={!label} style={label ? {left: label.left, top: label.top} : undefined}>{label?.text}</div>;
}
