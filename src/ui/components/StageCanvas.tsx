import { useEffect, useRef } from 'react';
import { Stage, type StageSurface, type TextureResolver } from '@/engine/Stage';
import { MediaTextureCache } from '@/engine/MediaTextureCache';
import { useProjectStore } from '@/stores/projectStore';
import { useOutputStore } from '@/stores/outputStore';
import { useElementSize } from '@/ui/hooks/useElementSize';
import { blendZonesToEdgeBlend } from '@/utils/edgeBlend';
import type { Surface } from '@/types';
import { ControlPointsOverlay } from './ControlPointsOverlay';
import { MaskOverlay } from './MaskOverlay';

function toStageSurfaces(surfaces: Surface[]): StageSurface[] {
  return surfaces
    .filter((s) => s.visible)
    .map((s) => ({
      id: s.id,
      warpMode: s.warpMode,
      controlPoints: s.controlPoints,
      gridSize: s.gridSize ?? { cols: 1, rows: 1 },
      layers: s.layers.map((l) => ({
        id: l.id,
        kind: l.source.kind,
        blendMode: l.blendMode,
        opacity: l.opacity,
        visible: l.visible,
        shaderCode: l.source.shaderCode,
        particles: l.source.particles,
      })),
      mask: s.mask ? { enabled: s.mask.enabled, points: s.mask.points } : undefined,
      blend: blendZonesToEdgeBlend(s.blendZones),
    }));
}

function activeMediaKeys(surfaces: Surface[]): Set<string> {
  const keys = new Set<string>();
  surfaces.forEach((s) =>
    s.layers.forEach((l) => {
      if (l.source.kind !== 'pattern') keys.add(l.id);
    }),
  );
  return keys;
}

export function StageCanvas() {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Stage | null>(null);
  const cacheRef = useRef<MediaTextureCache | null>(null);
  const resyncRef = useRef<() => void>(() => {});

  const surfaces = useProjectStore((s) => s.project.surfaces);
  const selectedSurfaceId = useProjectStore((s) => s.selectedSurfaceId);
  const resolution = useProjectStore((s) => s.project.resolution);
  const targetDisplayId = useOutputStore((s) => s.targetDisplayId);
  const displays = useOutputStore((s) => s.displays);

  // Le cadre adopte le ratio de l'écran de sortie EFFECTIF (cf. Phase 1).
  const stageSize = useElementSize(stageRef);
  const autoDisplay = displays.find((d) => !d.primary) ?? displays.find((d) => d.primary);
  const target = displays.find((d) => d.id === targetDisplayId) ?? autoDisplay;
  const aspect = target
    ? target.bounds.width / target.bounds.height
    : resolution.width / resolution.height;

  let frameWidth = stageSize.width;
  let frameHeight = stageSize.width / aspect;
  if (frameHeight > stageSize.height) {
    frameHeight = stageSize.height;
    frameWidth = stageSize.height * aspect;
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new Stage(canvas);
    engine.setShowOutlines(true);
    const cache = new MediaTextureCache(() => resyncRef.current());

    const resolve: TextureResolver = (surfaceId, layer) => {
      const proj = useProjectStore.getState().project;
      const source = proj.surfaces
        .find((s) => s.id === surfaceId)
        ?.layers.find((l) => l.id === layer.id)?.source;
      if (
        !source ||
        source.kind === 'pattern' ||
        source.kind === 'generative' ||
        source.kind === 'particles'
      )
        return null;
      return cache.get(layer.id, {
        kind: source.kind,
        dataUrl: source.dataUrl,
        deviceId: source.deviceId,
      });
    };

    resyncRef.current = () => {
      const state = useProjectStore.getState();
      engine.sync(toStageSurfaces(state.project.surfaces), state.selectedSurfaceId, resolve);
    };

    engineRef.current = engine;
    cacheRef.current = cache;
    resyncRef.current();

    return () => {
      engine.dispose();
      cache.dispose();
      engineRef.current = null;
      cacheRef.current = null;
    };
  }, []);

  useEffect(() => {
    cacheRef.current?.prune(activeMediaKeys(surfaces));
    resyncRef.current();
  }, [surfaces, selectedSurfaceId]);

  return (
    <div ref={stageRef} className="stage">
      <div
        className="stage-frame"
        style={{ width: `${Math.round(frameWidth)}px`, height: `${Math.round(frameHeight)}px` }}
      >
        <canvas ref={canvasRef} className="stage-canvas" />
        <ControlPointsOverlay />
        <MaskOverlay />
      </div>
    </div>
  );
}
