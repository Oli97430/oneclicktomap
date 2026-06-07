import { create } from 'zustand';
import type { Vec2 } from '@/types';

/** Résultat de détection conservé entre la capture et la création de surface. */
export interface DetectionResult {
  /** Quadrilatère détecté en pixels de l'image réduite (ordre [HG,HD,BD,BG]). */
  quad: Vec2[];
  /** Points de contrôle normalisés [0,1] prêts pour une Surface. */
  controlPoints: Vec2[];
  /** Dimensions de l'image analysée. */
  width: number;
  height: number;
}

interface DetectionStore {
  /** Caméra active (preview en direct). */
  enabled: boolean;
  /** Périphérique vidéo sélectionné (null = défaut). */
  deviceId: string | null;
  /** Dernière détection en date (null si aucune / effacée). */
  detection: DetectionResult | null;

  setEnabled: (enabled: boolean) => void;
  toggle: () => void;
  setDeviceId: (deviceId: string | null) => void;
  setDetection: (detection: DetectionResult | null) => void;
}

export const useDetectionStore = create<DetectionStore>((set) => ({
  enabled: false,
  deviceId: null,
  detection: null,

  setEnabled: (enabled) => set((s) => ({ enabled, detection: enabled ? s.detection : null })),
  toggle: () => set((s) => ({ enabled: !s.enabled, detection: s.enabled ? null : s.detection })),
  setDeviceId: (deviceId) => set({ deviceId, detection: null }),
  setDetection: (detection) => set({ detection }),
}));
