import type { MaskPath, Surface, TransitionKind, Vec2 } from '@/types';
import { cloneSurface } from './snapshot';

export const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Lissage cubique ease-in-out (accélère puis décélère). */
export function easeInOut(t: number): number {
  const c = clamp01(t);
  return c < 0.5 ? 2 * c * c : 1 - (-2 * c + 2) ** 2 / 2;
}

function lerpPoints(a: Vec2[], b: Vec2[], t: number): Vec2[] {
  return a.map((p, i) => ({ x: lerp(p.x, b[i].x, t), y: lerp(p.y, b[i].y, t) }));
}

/** Géométrie interpolable seulement si même mode de warp et même nombre de points. */
function geometryCompatible(a: Surface, b: Surface): boolean {
  return a.warpMode === b.warpMode && a.controlPoints.length === b.controlPoints.length;
}

function interpMask(from: Surface, to: Surface, t: number): MaskPath | undefined {
  const a = from.mask;
  const b = to.mask;
  if (!b) return undefined;
  if (a && a.enabled && b.enabled && a.points.length === b.points.length) {
    return { enabled: true, points: lerpPoints(a.points, b.points, t) };
  }
  return { enabled: b.enabled, points: b.points.map((p) => ({ ...p })) };
}

/**
 * État affiché des surfaces à la progression t∈[0,1] d'une transition de `from`
 * vers `to`. Modèle « graphe unique » (le moteur rend un seul jeu de surfaces) :
 *
 * - `cut`  : bascule instantanée (from tant que t<1, puis to).
 * - `fade` : la géométrie prend la cible ; l'opacité fait un fondu enchaîné.
 * - `morph`: la géométrie des surfaces communes (compatibles) est interpolée.
 *
 * Surfaces communes (même id) : opacité interpolée, contenu pris de la cible.
 * Surfaces seulement dans `from` : fondu sortant. Seulement dans `to` : fondu entrant.
 */
export function interpolateSurfaces(
  from: Surface[],
  to: Surface[],
  tRaw: number,
  kind: TransitionKind,
): Surface[] {
  const t = clamp01(tRaw);
  if (kind === 'cut') return (t < 1 ? from : to).map(cloneSurface);

  const eased = easeInOut(t);
  const fromById = new Map(from.map((s) => [s.id, s]));
  const toById = new Map(to.map((s) => [s.id, s]));
  const out: Surface[] = [];

  // Surfaces de la cible : communes (morphées) + nouvelles (fondu entrant).
  for (const tgt of to) {
    const src = fromById.get(tgt.id);
    if (!src) {
      out.push({ ...cloneSurface(tgt), opacity: tgt.opacity * t });
      continue;
    }
    const morphGeom = kind === 'morph' && geometryCompatible(src, tgt);
    const next = cloneSurface(tgt);
    next.opacity = lerp(src.opacity, tgt.opacity, t);
    if (morphGeom) {
      next.controlPoints = lerpPoints(src.controlPoints, tgt.controlPoints, eased);
      next.mask = interpMask(src, tgt, eased);
    }
    out.push(next);
  }

  // Surfaces supprimées (présentes seulement dans `from`) : fondu sortant.
  for (const src of from) {
    if (toById.has(src.id)) continue;
    out.push({ ...cloneSurface(src), opacity: src.opacity * (1 - t) });
  }

  return out;
}
