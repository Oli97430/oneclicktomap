import { useEffect, useRef, useState } from 'react';
import { Stage, type StageSurface, type TextureResolver } from '@/engine/Stage';
import { MediaTextureCache } from '@/engine/MediaTextureCache';
import { resetAudioFeatures, setAudioFeatures } from '@/content/audioBus';
import type { EdgeBlend } from '@/utils/edgeBlend';
import type { CalibrationPattern, LiveState, OutputAssets, OutputLayer, OutputSurfaceState } from '../../../shared/contract';

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
        shaderCode: l.kind === 'generative' ? assets[l.id] : undefined,
        particles: l.particles,
        transform: l.transform,
        // D2 : valeurs des uniforms exposes
        shaderParams: l.shaderParams,
      })),
      mask: o.mask,
      blend: toEdgeBlend(o.blend),
    }));
}

/**
 * Vue de sortie (projecteur) : canvas plein ecran sans interface.
 * Inclut une surcouche de calibration (E1) quand un motif est recu.
 */
export function OutputView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // E1 : motif de calibration projete
  const [calibPattern, setCalibPattern] = useState<CalibrationPattern | null>(null);
  // H1/H2 : état live reçu depuis l'éditeur via IPC
  const [liveState, setLiveState] = useState<LiveState>({ blackout: false, freeze: false });

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
        streamUrl: out?.streamUrl,
        webUrl: out?.webUrl,
        windowSourceId: out?.windowSourceId,
        windowName: out?.windowName,
      });
    };
    const resync = () => stage.sync(toStageSurfaces(surfaces, assets), null, resolve);

    // Tick par frame : met à jour les textures vidéo / flux (cf. MediaTextureCache.update).
    stage.onFrameTick = () => cache.update();

    const api = window.oneClickToMap;

    // H1/H2 : réception de l'état live depuis l'éditeur.
    const offLive = api?.onLiveState((state) => {
      setLiveState(state);
      cache.setFrozen(state.freeze);
    });
    const offSurfaces = api?.onOutputSurfaces((list) => {
      surfaces = list;
      const mine = list.filter((s) => (s.output ?? 0) === OUTPUT_INDEX);
      layerById.clear();
      mine.forEach((s) => s.layers.forEach((l) => layerById.set(l.id, l)));
      cache.prune(
        new Set(
          mine
            .flatMap((s) => s.layers)
            .filter((l) =>
              l.kind === 'image' || l.kind === 'video' || l.kind === 'webcam' ||
              l.kind === 'text' || l.kind === 'stream' || l.kind === 'web' ||
              l.kind === 'window'
            )
            .map((l) => l.id),
        ),
      );
      resync();
    });
    const offAssets = api?.onOutputAssets((next) => {
      assets = next;
      resync();
    });
    const offAudio = api?.onOutputAudio((audio) => setAudioFeatures(audio));

    // E1 : reception des motifs de calibration
    const offCalib = api?.onCalibrationPattern((pattern) => {
      if (pattern.index < 0) {
        setCalibPattern(null);
      } else {
        setCalibPattern(pattern);
      }
    });

    api?.requestOutputSync();

    return () => {
      offSurfaces?.();
      offAssets?.();
      offAudio?.();
      offCalib?.();
      offLive?.();
      resetAudioFeatures();
      cache.dispose();
      stage.dispose();
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="output-canvas" />
      {/* H1 : overlay blackout sortie */}
      {liveState.blackout && <div className="blackout-overlay" aria-hidden="true" />}
      {/* E1 : surcouche de calibration - recouvre entierement le rendu */}
      {calibPattern && calibPattern.index >= 0 && (
        <img
          src={calibPattern.imageData}
          className="calib-overlay"
          alt={`Motif de calibration ${calibPattern.index + 1}/${calibPattern.totalCount}`}
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'fill',
            zIndex: 9999,
            pointerEvents: 'none',
          }}
        />
      )}
    </>
  );
}
