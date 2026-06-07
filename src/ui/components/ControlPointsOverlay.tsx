import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { CONTROL_POINT_LABELS, useProjectStore } from '@/stores/projectStore';
import type { Vec2 } from '@/types';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function ControlPointsOverlay() {
  const surfaces = useProjectStore((s) => s.project.surfaces);
  const selectedSurfaceId = useProjectStore((s) => s.selectedSurfaceId);
  const selected = useProjectStore((s) => s.selectedPoint);
  const setSelected = useProjectStore((s) => s.setSelectedPoint);
  const beginDrag = useProjectStore((s) => s.beginDrag);
  const updateTransient = useProjectStore((s) => s.updateControlPointTransient);
  const endDrag = useProjectStore((s) => s.endDrag);
  const nudge = useProjectStore((s) => s.nudgeControlPoint);
  const overlayRef = useRef<HTMLDivElement>(null);

  const surface = surfaces.find((s) => s.id === selectedSurfaceId);
  if (!surface) return null;

  const isGrid = surface.warpMode === 'grid';

  const positionFromEvent = (clientX: number, clientY: number): Vec2 => {
    const rect = overlayRef.current!.getBoundingClientRect();
    return {
      x: clamp01((clientX - rect.left) / rect.width),
      y: clamp01((clientY - rect.top) / rect.height),
    };
  };

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>, index: number) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelected(index);
    beginDrag();
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>, index: number) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    updateTransient(surface.id, index, positionFromEvent(event.clientX, event.clientY));
  };

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.releasePointerCapture(event.pointerId);
    endDrag();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = event.shiftKey ? 0.05 : 0.005;
    const point = surface.controlPoints[index];
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

  const labelFor = (index: number): string =>
    isGrid ? `Point ${index + 1}` : (CONTROL_POINT_LABELS[index] ?? `Point ${index + 1}`);

  return (
    <div ref={overlayRef} className={`cp-overlay${isGrid ? ' is-grid' : ''}`}>
      {surface.controlPoints.map((point, index) => (
        <button
          key={index}
          type="button"
          className={`cp-handle${selected === index ? ' is-selected' : ''}`}
          style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
          onPointerDown={(event) => handlePointerDown(event, index)}
          onPointerMove={(event) => handlePointerMove(event, index)}
          onPointerUp={handlePointerUp}
          onKeyDown={(event) => handleKeyDown(event, index)}
          onFocus={() => setSelected(index)}
          aria-label={`Point de contrôle ${labelFor(index)}`}
          title={labelFor(index)}
        />
      ))}
    </div>
  );
}
