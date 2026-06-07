import { useEffect } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useOutputStore } from '@/stores/outputStore';
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
        return [];
      }),
    )
    .join('|');
  useEffect(() => {
    window.oneClickToMap?.sendOutputAssets(toAssets(useProjectStore.getState().project.surfaces));
  }, [assetsSig]);

  useEffect(() => {
    const api = window.oneClickToMap;
    if (!api) return;

    const offSync = api.onRequestSync(() => {
      const current = useProjectStore.getState().project.surfaces;
      api.sendOutputSurfaces(toOutputSurfaces(current));
      api.sendOutputAssets(toAssets(current));
    });
    const offStatus = api.onOutputStatusChanged((status) => setStatus(status));

    return () => {
      offSync();
      offStatus();
    };
  }, [setStatus]);
}
