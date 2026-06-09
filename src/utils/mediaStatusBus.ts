/**
 * Bus de statut des médias (vidéo / webcam / flux).
 *
 * MediaTextureCache vit dans le moteur Three.js (hors React) ; ce bus permet
 * à l'UI (LayersPanel) de connaître l'état de chargement réel d'un calque sans
 * couplage direct au cache. Un statut « error » signale un échec de décodage —
 * typiquement un codec non supporté par le FFmpeg d'Electron (ex. H.265/HEVC).
 */

export type MediaStatus = 'loading' | 'ready' | 'error';

const statuses = new Map<string, MediaStatus>();
const listeners = new Set<() => void>();

/** Définit le statut d'un média (par id de calque) et notifie les abonnés. */
export function setMediaStatus(id: string, status: MediaStatus): void {
  if (statuses.get(id) === status) return;
  statuses.set(id, status);
  listeners.forEach((l) => l());
}

/** Lit le statut courant d'un média (par défaut « loading »). */
export function getMediaStatus(id: string): MediaStatus {
  return statuses.get(id) ?? 'loading';
}

/** Oublie le statut d'un média (calque supprimé / cache purgé). */
export function clearMediaStatus(id: string): void {
  if (statuses.delete(id)) listeners.forEach((l) => l());
}

/** S'abonne aux changements de statut. Retourne la fonction de désabonnement. */
export function subscribeMediaStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
