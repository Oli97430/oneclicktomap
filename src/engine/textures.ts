import * as THREE from 'three';
import type { Vec2 } from '@/types';
import { smoothClosedPath } from '@/utils/mask';

/**
 * Génère une mire (damier) avec repères colorés pour visualiser la déformation
 * et vérifier l'orientation : rouge = haut-gauche, vert = haut-droite.
 */
export function createCheckerTexture(size = 1024, cells = 8): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Contexte 2D indisponible pour la mire');

  const step = size / cells;
  for (let y = 0; y < cells; y += 1) {
    for (let x = 0; x < cells; x += 1) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#e2e8f0' : '#1e293b';
      ctx.fillRect(x * step, y * step, step, step);
    }
  }

  // Repères d'orientation.
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(0, 0, step, step);
  ctx.fillStyle = '#22c55e';
  ctx.fillRect(size - step, 0, step, step);

  // Grille fine pour mieux percevoir la perspective.
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
  ctx.lineWidth = Math.max(1, size / 512);
  for (let i = 0; i <= cells; i += 1) {
    const p = i * step;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Rasterise un masque de découpe (chemin fermé lissé) en texture alpha :
 * blanc opaque à l'intérieur, transparent à l'extérieur. Repère haut-gauche
 * [0,1] -> [0,size] ; flipY=false pour un échantillonnage direct.
 */
export function createMaskTexture(points: Vec2[], size = 512): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Contexte 2D indisponible pour le masque');

  ctx.clearRect(0, 0, size, size);
  const segments = smoothClosedPath(points);
  if (segments.length > 0) {
    ctx.beginPath();
    ctx.moveTo(points[0].x * size, points[0].y * size);
    for (const seg of segments) {
      ctx.bezierCurveTo(
        seg.c1.x * size,
        seg.c1.y * size,
        seg.c2.x * size,
        seg.c2.y * size,
        seg.end.x * size,
        seg.end.y * size,
      );
    }
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false;
  texture.needsUpdate = true;
  return texture;
}

/** Texture 1×1 blanche opaque (masque neutre par défaut). */
export function createSolidTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Contexte 2D indisponible');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 1, 1);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
