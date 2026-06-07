import { useEffect, useRef } from 'react';
import { Stage, type StageSurface, type TextureResolver } from '@/engine/Stage';
import { MediaTextureCache } from '@/engine/MediaTextureCache';
import { useProjectStore } from '@/stores/projectStore';
import { useOutputStore } from '@/stores/outputStore';
import { useElementSize } from '@/ui/hooks/useElementSize';
import { blendZonesToEdgeBlend } from '@/utils/edgeBlend';
import { registerCanvas, onScreenshotRequest, onRecordRequest } from '@/utils/captureBus';
import type { Surface } from '@/types';
import { ControlPointsOverlay } from './ControlPointsOverlay';
import { MaskOverlay } from './MaskOverlay';
import { LayerTransformOverlay } from './LayerTransformOverlay';

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
        transform: l.transform,
        shaderParams: l.source.shaderParams,
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
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const surfaces = useProjectStore((s) => s.project.surfaces);
  const selectedSurfaceId = useProjectStore((s) => s.selectedSurfaceId);
  const resolution = useProjectStore((s) => s.project.resolution);
  const targetDisplayId = useOutputStore((s) => s.targetDisplayId);
  const displays = useOutputStore((s) => s.displays);

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

  // Cycle de vie du moteur Three.js.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    registerCanvas(canvas);
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
        streamUrl: source.streamUrl,
        textParams: source.textParams,
      });
    };

    resyncRef.current = () => {
      const state = useProjectStore.getState();
      engine.sync(toStageSurfaces(state.project.surfaces), state.selectedSurfaceId, resolve);
    };

    // Tick par frame : met à jour les textures vidéo (cf. MediaTextureCache.update).
    engine.onFrameTick = () => cache.update();

    engineRef.current = engine;
    cacheRef.current = cache;
    resyncRef.current();

    return () => {
      registerCanvas(null);
      engine.dispose();
      cache.dispose();
      engineRef.current = null;
      cacheRef.current = null;
    };
  }, []);

  // Sync surfaces.
  useEffect(() => {
    cacheRef.current?.prune(activeMediaKeys(surfaces));
    resyncRef.current();
  }, [surfaces, selectedSurfaceId]);

  // A6 : screenshot via le bus de capture.
  useEffect(() => {
    return onScreenshotRequest(async (canvas) => {
      const dataUrl = canvas.toDataURL('image/png');
      const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
      const result = await window.oneClickToMap?.saveScreenshot(base64);
      if (result && !result.ok && !result.canceled) {
        console.error('[screenshot]', result.error);
      }
    });
  }, []);

  // A5 : capture vidéo via le bus de capture.
  useEffect(() => {
    return onRecordRequest((canvas, action) => {
      if (action === 'start') {
        if (recorderRef.current) return; // déjà en cours
        const stream = canvas.captureStream(30);
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
        chunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: 'video/webm' });
          const reader = new FileReader();
          reader.onload = async () => {
            const base64 = (reader.result as string).replace(/^data:video\/webm;base64,/, '');
            const result = await window.oneClickToMap?.saveCapture(base64);
            if (result && !result.ok && !result.canceled) {
              console.error('[capture]', result.error);
            }
          };
          reader.readAsDataURL(blob);
          recorderRef.current = null;
        };
        recorder.start(200); // chunk toutes les 200ms
        recorderRef.current = recorder;
      } else if (action === 'stop') {
        recorderRef.current?.stop();
      }
    });
  }, []);

  // A2 : drag-and-drop de fichiers sur le canvas → ajout à la bibliothèque de médias.
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const { selectedSurfaceId: sid } = useProjectStore.getState();
    if (!sid) return;
    Array.from(e.dataTransfer.files).forEach((file) => {
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        const reader = new FileReader();
        reader.onload = () => {
          const kind = file.type.startsWith('image/') ? 'image' : 'video';
          useProjectStore.getState().addLayer(sid, { kind, dataUrl: reader.result as string }, file.name);
        };
        reader.readAsDataURL(file);
      }
    });
  };

  return (
    <div ref={stageRef} className="stage" onDragOver={handleDragOver} onDrop={handleDrop}>
      <div
        className="stage-frame"
        style={{ width: `${Math.round(frameWidth)}px`, height: `${Math.round(frameHeight)}px` }}
      >
        <canvas ref={canvasRef} className="stage-canvas" />
        <ControlPointsOverlay />
        <LayerTransformOverlay />
        <MaskOverlay />
      </div>
    </div>
  );
}
