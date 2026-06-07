import { useEffect, useRef } from 'react';
import { Stage, type StageSurface, type TextureResolver } from '@/engine/Stage';
import { MediaTextureCache } from '@/engine/MediaTextureCache';
import { resetAudioFeatures, setAudioFeatures } from '@/content/audioBus';
import type { EdgeBlend } from '@/utils/edgeBlend';
import type { OutputAssets, OutputLayer, OutputSurfaceState } from '../../../shared/contract';

const toVec4 = (a: number[] | undefined, fallback: number): [number, number, number, number] => [
  a?.[0] ?? fallback,
  a?.[1] ?? fallback,
  a?.[2] ?? fallback,
  a?.[3] ?? fallback,
];

function toEdgeBlend(blend: OutputSurfaceState['blend']): EdgeBlend | undefined {
  if (!blend) return undefined;
  return { size: toVec4(blend.size, 0), gamma: toVec4(blend.gamma, 1) };
}

/** Index de sortie de cette fenêtre (?out=N) : ne rend que les surfaces affectées. */
const OUTPUT_INDEX = (() => {
  const raw = Number(new URLSearchParams(window.location.search).get('out'));
  return Number.isFinite(raw) ? raw : 0;
})();

function toStageSurfaces(list: OutputSurfaceState[], assets: OutputAssets): StageSurface[] {
  return list
    .filter((o) => (o.output ?? 0) === OUTPUT_INDEX)
    .map((o) => ({
      id: o.id,
      warpMode: o.warpMode,
      controlPoints: o.controlPoints,
      gridSize: { cols: o.gridCols, rows: o.gridRows },
      layers: o.layers.map((l) => ({
        id: l.id,
        kind: l.kind,
        blendMode: l.blendMode,
        opacity: l.opacity,
        visible: l.visible,
        // Le code des shaders génératifs arrive par le canal assets (rare).
        shaderCode: l.kind === 'generative' ? assets[l.id] : undefined,
        particles: l.particles,
      })),
      mask: o.mask,
      blend: toEdgeBlend(o.blend),
    }));
}

/**
 * Vue de sortie (projecteur) : un canvas plein écran rendant toutes les surfaces
 * et leurs calques (image / vidéo / webcam), sans interface ni contour. Alimentée
 * par IPC (géométrie + assets), avec un cache de textures local.
 */
export function OutputView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const stage = new Stage(canvas, { background: 0x000000 });
    stage.setShowOutlines(false);

    let surfaces: OutputSurfaceState[] = [];
    let assets: OutputAssets = {};
    const layerById = new Map<string, OutputLayer>();
    const cache = new MediaTextureCache(() => resync());

    const resolve: TextureResolver = (_surfaceId, layer) => {
      if (layer.kind === 'pattern' || layer.kind === 'generative' || layer.kind === 'particles')
        return null;
      const out = layerById.get(layer.id);
      return cache.get(layer.id, {
        kind: layer.kind,
        dataUrl: assets[layer.id],
        deviceId: out?.deviceId,
      });
    };
    const resync = () => stage.sync(toStageSurfaces(surfaces, assets), null, resolve);

    const api = window.oneClickToMap;
    const offSurfaces = api?.onOutputSurfaces((list) => {
      surfaces = list;
      // Seules les surfaces de CET index produisent des textures : on aligne le
      // prune sur le rendu, sinon les flux (webcam) des autres index fuiteraient.
      const mine = list.filter((s) => (s.output ?? 0) === OUTPUT_INDEX);
      layerById.clear();
      mine.forEach((s) => s.layers.forEach((l) => layerById.set(l.id, l)));
      cache.prune(
        new Set(
          mine
            .flatMap((s) => s.layers)
            .filter((l) => l.kind === 'image' || l.kind === 'video' || l.kind === 'webcam')
            .map((l) => l.id),
        ),
      );
      resync();
    });
    const offAssets = api?.onOutputAssets((next) => {
      assets = next;
      resync();
    });
    // Features audio : écrites sur le bus local, lues par le moteur à chaque frame.
    const offAudio = api?.onOutputAudio((audio) => setAudioFeatures(audio));
    api?.requestOutputSync();

    return () => {
      offSurfaces?.();
      offAssets?.();
      offAudio?.();
      resetAudioFeatures();
      cache.dispose();
      stage.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className="output-canvas" />;
}
