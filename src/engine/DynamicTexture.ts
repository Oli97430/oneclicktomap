import type * as THREE from 'three';
import type { AudioFeatures } from '@/content/audioBus';

/**
 * Source de texture animée rendue hors-écran chaque frame (shader génératif,
 * particules…). Le résultat sert de contenu de calque, déformé/fusionné/masqué
 * comme toute autre texture. `audio` fournit les features audio-réactives.
 */
export interface DynamicTexture {
  readonly texture: THREE.Texture;
  render(renderer: THREE.WebGLRenderer, time: number, audio: AudioFeatures): void;
  dispose(): void;
}
