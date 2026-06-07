import type { Layer, Surface } from '@/types';

/** Copie profonde d'un calque (pour figer un instantané de scène). */
export function cloneLayer(layer: Layer): Layer {
  const particles = layer.source.particles;
  return {
    ...layer,
    source: {
      ...layer.source,
      particles: particles ? { ...particles, color: [...particles.color] } : undefined,
    },
  };
}

/** Copie profonde d'une surface (points, masque, calques, blend zones). */
export function cloneSurface(surface: Surface): Surface {
  return {
    ...surface,
    controlPoints: surface.controlPoints.map((p) => ({ ...p })),
    gridSize: surface.gridSize ? { ...surface.gridSize } : undefined,
    mask: surface.mask
      ? { enabled: surface.mask.enabled, points: surface.mask.points.map((p) => ({ ...p })) }
      : undefined,
    layers: surface.layers.map(cloneLayer),
    blendZones: surface.blendZones.map((b) => ({ ...b })),
  };
}

/** Copie profonde d'un tableau de surfaces. */
export function cloneSurfaces(surfaces: Surface[]): Surface[] {
  return surfaces.map(cloneSurface);
}
