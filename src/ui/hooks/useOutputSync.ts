import { useEffect } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useOutputStore } from '@/stores/outputStore';
import { useLiveStore } from '@/stores/liveStore';
import { blendZonesToEdgeBlend } from '@/utils/edgeBlend';
import type { Surface } from '@/types';
import type { OutputAssets, OutputSurfaceState } from '../../../shared/contract';

function toOutputSurfaces(surfaces: Surface[]): OutputSurfaceState[] {
  return surfaces
    .filter((s) => s.visible)
    .map((s) => ({
      id: s.id,
      warpMode: s.warpMode === 'grid' ? 'grid' : 'quad',
      controlPoints: s.controlPoints,
      gridCols: s.gridSize?.cols ?? 1,
      gridRows: s.gridSize?.rows ?? 1,
      output: s.output ?? 0,
      layers: s.layers.map((l) => ({
        id: l.id,
        kind: l.source.kind,
        blendMode: l.blendMode,
        opacity: l.opacity,
        visible: l.visible,
        deviceId: l.source.deviceId,
        particles: l.source.particles,
        transform: l.transform,
        // C6 : flux HLS/RTSP
        streamUrl: l.source.streamUrl,
        // D2 : valeurs des uniforms exposés
        shaderParams: l.source.shaderParams,
        // Source web (rendu hors-écran)
        webUrl: l.source.webUrl,
        // Capture de fenêtre / écran
        windowSourceId: l.source.windowSourceId,
        windowName: l.source.windowName,
      })),
      mask: s.mask ? { enabled: s.mask.enabled, points: s.mask.points } : undefined,
      blend: blendZonesToEdgeBlend(s.blendZones),
    }));
}

function toAssets(surfaces: Surface[]): OutputAssets {
  const assets: OutputAssets = {};
  surfaces.forEach((s) => {
    s.layers.forEach((l) => {
      if ((l.source.kind === 'image' || l.source.kind === 'video') && l.source.dataUrl) {
        assets[l.id] = l.source.dataUrl;
      } else if (l.source.kind === 'generative' && l.source.shaderCode) {
        assets[l.id] = l.source.shaderCode;
      }
    });
  });
  return assets;
}

/**
 * Côté éditeur : diffuse la géométrie + styles des surfaces (fréquent, léger)
 * et le contenu des calques image (rare, volumineux) séparément vers la sortie.
 */
export function useOutputSync(): void {
  const surfaces = useProjectStore((s) => s.project.surfaces);
  const setStatus = useOutputStore((s) => s.setStatus);
  const blackout = useLiveStore((s) => s.blackout);
  const freeze = useLiveStore((s) => s.freeze);

  // Géométrie + styles : à chaque changement (y compris glisser).
  useEffect(() => {
    window.oneClickToMap?.sendOutputSurfaces(toOutputSurfaces(surfaces));
  }, [surfaces]);

  // Assets (image/vidéo data URL + code des shaders génératifs) : envoyés seulement
  // quand leur contenu change (pas à chaque glisser de point de contrôle).
  const assetsSig = surfaces
    .flatMap((s) =>
      s.layers.flatMap((l) => {
        if (l.source.kind === 'image' || l.source.kind === 'video') return [l.id];
        if (l.source.kind === 'generative') return [`${l.id}:${l.source.shaderCode ?? ''}`];
        if (l.source.kind === 'stream') return [`${l.id}:stream:${l.source.streamUrl ?? ''}`];
        if (l.source.kind === 'web') return [`${l.id}:web:${l.source.webUrl ?? ''}`];
        return [];
      }),
    )
    .join('|');
  useEffect(() => {
    window.oneClickToMap?.sendOutputAssets(toAssets(useProjectStore.getState().project.surfaces));
  }, [assetsSig]);

  // H1/H2 : diffuse l'état live (blackout, freeze) à chaque changement.
  useEffect(() => {
    window.oneClickToMap?.sendLiveState({ blackout, freeze });
  }, [blackout, freeze]);

  useEffect(() => {
    const api = window.oneClickToMap;
    if (!api) return;

    const offSync = api.onRequestSync(() => {
      const current = useProjectStore.getState().project.surfaces;
      api.sendOutputSurfaces(toOutputSurfaces(current));
      api.sendOutputAssets(toAssets(current));
      // Resync live state vers la sortie (cas reconnexion output).
      const live = useLiveStore.getState();
      api.sendLiveState({ blackout: live.blackout, freeze: live.freeze });
    });
    const offStatus = api.onOutputStatusChanged((status) => setStatus(status));

    return () => {
      offSync();
      offStatus();
    };
  }, [setStatus]);
}
