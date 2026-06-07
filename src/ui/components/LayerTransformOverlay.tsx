import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useElementSize } from '@/ui/hooks/useElementSize';
import {
  clampOffset,
  clampScale,
  normalizeTransform,
  quadPoint,
  surfaceCorners,
  surfaceDeltaFromOutputDelta,
} from '@/utils/layerTransform';
import type { LayerTransform, Vec2 } from '@/types';

type Mode = 'move' | 'rotate' | 'scale';

const R_ROTATE = 58; // distance px de la poignée de rotation au centre
const R_SCALE = 46; // distance px de la poignée d'échelle au centre

interface DragState {
  mode: Mode;
  corners: [Vec2, Vec2, Vec2, Vec2];
  width: number;
  height: number;
  work: LayerTransform;
  lastX: number;
  lastY: number;
  centerX: number; // centre du calque en px absolus (client)
  centerY: number;
  startAngle: number; // rotate : angle pointeur - rotation courante
  startDist: number; // scale : distance pointeur↔centre au départ
  startScale: number;
}

/**
 * Gizmo de repositionnement du contenu du calque sélectionné DANS sa surface :
 * glisser le centre = déplacer, la poignée haute = pivoter, la poignée d'angle =
 * mettre à l'échelle. Indépendant de la déformation (warp) de la surface.
 */
export function LayerTransformOverlay() {
  const surfaces = useProjectStore((s) => s.project.surfaces);
  const selectedSurfaceId = useProjectStore((s) => s.selectedSurfaceId);
  const selectedLayerId = useProjectStore((s) => s.selectedLayerId);
  const beginDrag = useProjectStore((s) => s.beginDrag);
  const endDrag = useProjectStore((s) => s.endDrag);
  const setTransient = useProjectStore((s) => s.setLayerTransformTransient);
  const nudge = useProjectStore((s) => s.nudgeLayerTransform);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const size = useElementSize(overlayRef);

  const surface = surfaces.find((s) => s.id === selectedSurfaceId);
  const layer = surface
    ? (surface.layers.find((l) => l.id === selectedLayerId) ??
      surface.layers[surface.layers.length - 1])
    : undefined;

  // Le conteneur est toujours rendu (mesure via ResizeObserver) ; les poignées
  // n'apparaissent qu'avec une surface, un calque et une taille connue.
  const ready = !!surface && !!layer && size.width > 0 && size.height > 0;

  const t = normalizeTransform(layer?.transform);
  const corners = surface
    ? surfaceCorners(
        surface.warpMode,
        surface.controlPoints,
        surface.gridSize ?? { cols: 1, rows: 1 },
      )
    : null;
  const centerN = corners
    ? quadPoint(corners, 0.5 + t.offsetX, 0.5 + t.offsetY)
    : { x: 0.5, y: 0.5 };
  const cx = centerN.x * size.width;
  const cy = centerN.y * size.height;

  // Rotation visuelle des poignées en espace écran (y vers le bas → sens horaire).
  const cos = Math.cos(t.rotation);
  const sin = Math.sin(t.rotation);
  const rot = (vx: number, vy: number): Vec2 => ({
    x: cx + (cos * vx - sin * vy),
    y: cy + (sin * vx + cos * vy),
  });
  const rotKnob = rot(0, -R_ROTATE);
  const scaleKnob = rot(R_SCALE, -R_SCALE);

  const commit = (next: LayerTransform) => {
    if (surface && layer) setTransient(surface.id, layer.id, next);
  };

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>, mode: Mode) => {
    if (!surface || !layer || !corners) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = overlayRef.current!.getBoundingClientRect();
    const centerAbsX = rect.left + cx;
    const centerAbsY = rect.top + cy;
    beginDrag();
    dragRef.current = {
      mode,
      corners,
      width: rect.width,
      height: rect.height,
      work: { ...t },
      lastX: event.clientX,
      lastY: event.clientY,
      centerX: centerAbsX,
      centerY: centerAbsY,
      startAngle: Math.atan2(event.clientY - centerAbsY, event.clientX - centerAbsX) - t.rotation,
      startDist: Math.max(1, Math.hypot(event.clientX - centerAbsX, event.clientY - centerAbsY)),
      startScale: t.scale,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d || !event.currentTarget.hasPointerCapture(event.pointerId)) return;

    if (d.mode === 'move') {
      const dnx = (event.clientX - d.lastX) / d.width;
      const dny = (event.clientY - d.lastY) / d.height;
      const duv = surfaceDeltaFromOutputDelta(d.corners, dnx, dny);
      d.work = {
        ...d.work,
        offsetX: clampOffset(d.work.offsetX + duv.x),
        offsetY: clampOffset(d.work.offsetY + duv.y),
      };
      d.lastX = event.clientX;
      d.lastY = event.clientY;
    } else if (d.mode === 'rotate') {
      const angle = Math.atan2(event.clientY - d.centerY, event.clientX - d.centerX);
      d.work = { ...d.work, rotation: angle - d.startAngle };
    } else {
      const dist = Math.hypot(event.clientX - d.centerX, event.clientY - d.centerY);
      d.work = { ...d.work, scale: clampScale((d.startScale * dist) / d.startDist) };
    }
    commit(d.work);
  };

  const onPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    endDrag();
  };

  const onKey = (event: KeyboardEvent<HTMLButtonElement>, mode: Mode) => {
    if (!surface || !layer) return;
    const big = event.shiftKey;
    let next: LayerTransform | null = null;
    if (mode === 'move') {
      const step = big ? 0.05 : 0.01;
      let { offsetX, offsetY } = t;
      if (event.key === 'ArrowLeft') offsetX -= step;
      else if (event.key === 'ArrowRight') offsetX += step;
      else if (event.key === 'ArrowUp') offsetY += step;
      else if (event.key === 'ArrowDown') offsetY -= step;
      else return;
      next = { ...t, offsetX: clampOffset(offsetX), offsetY: clampOffset(offsetY) };
    } else if (mode === 'rotate') {
      const step = big ? 0.1 : 0.02;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowDown')
        next = { ...t, rotation: t.rotation - step };
      else if (event.key === 'ArrowRight' || event.key === 'ArrowUp')
        next = { ...t, rotation: t.rotation + step };
      else return;
    } else {
      const step = big ? 0.1 : 0.02;
      if (event.key === 'ArrowRight' || event.key === 'ArrowUp')
        next = { ...t, scale: clampScale(t.scale + step) };
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown')
        next = { ...t, scale: clampScale(t.scale - step) };
      else return;
    }
    event.preventDefault();
    nudge(surface.id, layer.id, next);
  };

  const reset = () => {
    if (surface && layer)
      nudge(surface.id, layer.id, { offsetX: 0, offsetY: 0, scale: 1, rotation: 0 });
  };

  return (
    <div ref={overlayRef} className="lt-overlay">
      {ready && (
        <>
          <svg className="lt-lines" width={size.width} height={size.height}>
            <line x1={cx} y1={cy} x2={rotKnob.x} y2={rotKnob.y} />
            <line x1={cx} y1={cy} x2={scaleKnob.x} y2={scaleKnob.y} />
          </svg>
          <button
            type="button"
            className="lt-knob lt-move"
            style={{ left: `${cx}px`, top: `${cy}px` }}
            onPointerDown={(e) => onPointerDown(e, 'move')}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onKeyDown={(e) => onKey(e, 'move')}
            onDoubleClick={reset}
            aria-label="Déplacer le contenu du calque (double-clic : réinitialiser)"
            title="Glisser : déplacer · double-clic : réinitialiser"
          />
          <button
            type="button"
            className="lt-knob lt-rot"
            style={{ left: `${rotKnob.x}px`, top: `${rotKnob.y}px` }}
            onPointerDown={(e) => onPointerDown(e, 'rotate')}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onKeyDown={(e) => onKey(e, 'rotate')}
            aria-label="Pivoter le contenu du calque"
            title="Glisser : pivoter"
          />
          <button
            type="button"
            className="lt-knob lt-scale"
            style={{ left: `${scaleKnob.x}px`, top: `${scaleKnob.y}px` }}
            onPointerDown={(e) => onPointerDown(e, 'scale')}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onKeyDown={(e) => onKey(e, 'scale')}
            aria-label="Mettre à l'échelle le contenu du calque"
            title="Glisser : mettre à l'échelle"
          />
        </>
      )}
    </div>
  );
}
