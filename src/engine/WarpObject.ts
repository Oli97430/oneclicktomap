import type * as THREE from 'three';
import type { BlendMode, LayerTransform, Vec2 } from '@/types';
import type { EdgeBlend } from '@/utils/edgeBlend';

/**
 * Interface commune aux modes de déformation (quad perspective, grille mesh).
 * Un objet = un calque déformé (géométrie + texture + style de fusion).
 */
export interface WarpObject {
  /** Groupe Three.js (mesh déformé + contour) à ajouter à la scène. */
  readonly group: THREE.Group;
  setCorners(points: Vec2[], aspect: number): void;
  setTexture(texture: THREE.Texture): void;
  setMask(texture: THREE.Texture, enabled: boolean): void;
  setStyle(opacity: number, blendMode: BlendMode): void;
  setBlend(blend: EdgeBlend): void;
  /** Repositionne le contenu du calque dans la surface. @param aspect surface w/h. */
  setTransform(transform: LayerTransform, aspect: number): void;
  setVisible(visible: boolean): void;
  setOutlineVisible(visible: boolean): void;
  setRenderOrder(order: number): void;
  dispose(): void;
}
