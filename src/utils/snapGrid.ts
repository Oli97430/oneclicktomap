/**
 * H4 — Aimantation des points de contrôle sur une grille N×M configurable.
 * Opère en espace normalisé [0,1] comme les Vec2 du moteur.
 */
import type { Vec2 } from '@/types';

export interface SnapGrid {
  enabled: boolean;
  cols: number;
  rows: number;
}

/**
 * Aimante un point sur le nœud de grille le plus proche si la grille est activée.
 * cols/rows définissent le nombre de cellules (pas de nœuds = cols+1 × rows+1).
 */
export function snapToGrid(point: Vec2, grid: SnapGrid | undefined): Vec2 {
  if (!grid?.enabled || grid.cols < 1 || grid.rows < 1) return point;
  return {
    x: Math.round(point.x * grid.cols) / grid.cols,
    y: Math.round(point.y * grid.rows) / grid.rows,
  };
}

/** Distance (en espace normalisé) entre un point et le nœud de grille le plus proche. */
export function distToGridNode(point: Vec2, grid: SnapGrid): number {
  const s = snapToGrid(point, grid);
  return Math.hypot(point.x - s.x, point.y - s.y);
}
