import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import type { Vec2 } from '@/types';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Édition des points d'ancrage du masque de la surface sélectionnée (si actif). */
export function MaskOverlay() {
  const surfaces = useProjectStore((s) => s.project.surfaces);
  const selectedSurfaceId = useProjectStore((s) => s.selectedSurfaceId);
  const beginDrag = useProjectStore((s) => s.beginDrag);
  const updateTransient = useProjectStore((s) => s.updateMaskPointTransient);
  const endDrag = useProjectStore((s) => s.endDrag);
  const nudge = useProjectStore((s) => s.nudgeMaskPoint);
  const removeMaskPoint = useProjectStore((s) => s.removeMaskPoint);
  const overlayRef = useRef<HTMLDivElement>(null);

  const surface = surfaces.find((s) => s.id === selectedSurfaceId);
  if (!surface || !surface.mask?.enabled) return null;
  const points = surface.mask.points;

  const positionFromEvent = (clientX: number, clientY: number): Vec2 => {
    const rect = overlayRef.current!.getBoundingClientRect();
    return {
      x: clamp01((clientX - rect.left) / rect.width),
      y: clamp01((clientY - rect.top) / rect.height),
    };
  };

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    beginDrag();
  };

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>, index: number) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    updateTransient(surface.id, index, positionFromEvent(event.clientX, event.clientY));
  };

  const onPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.releasePointerCapture(event.pointerId);
    endDrag();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = event.shiftKey ? 0.05 : 0.005;
    const point = points[index];
    let { x, y } = point;
    switch (event.key) {
      case 'ArrowLeft':
        x -= step;
        break;
      case 'ArrowRight':
        x += step;
        break;
      case 'ArrowUp':
        y -= step;
        break;
      case 'ArrowDown':
        y += step;
        break;
      default:
        return;
    }
    event.preventDefault();
    nudge(surface.id, index, { x: clamp01(x), y: clamp01(y) });
  };

  return (
    <div ref={overlayRef} className="mask-overlay">
      {points.map((point, index) => (
        <button
          key={index}
          type="button"
          className="mask-handle"
          style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
          onPointerDown={onPointerDown}
          onPointerMove={(event) => onPointerMove(event, index)}
          onPointerUp={onPointerUp}
          onKeyDown={(event) => onKeyDown(event, index)}
          onDoubleClick={() => removeMaskPoint(surface.id, index)}
          aria-label={`Point de masque ${index + 1} (double-clic pour retirer)`}
          title="Glisser pour déplacer · double-clic pour retirer"
        />
      ))}
    </div>
  );
}
