import { useEffect } from 'react';
import { useAudioStore } from '@/stores/audioStore';
import { AudioEngine } from '@/content/AudioEngine';
import { resetAudioFeatures, SILENT_AUDIO } from '@/content/audioBus';

/**
 * Côté éditeur : démarre/arrête la capture audio selon l'état du store, publie
 * les features sur le bus local et les relaie à la fenêtre de sortie (IPC).
 */
export function useAudio(): void {
  const enabled = useAudioStore((s) => s.enabled);
  const setEnabled = useAudioStore((s) => s.setEnabled);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const engine = new AudioEngine((features) => window.oneClickToMap?.sendOutputAudio(features));
    engine.start().catch(() => {
      // Pas de micro / permission refusée : on revient à l'état désactivé.
      if (!cancelled) setEnabled(false);
    });

    return () => {
      cancelled = true;
      engine.stop();
      resetAudioFeatures();
      window.oneClickToMap?.sendOutputAudio(SILENT_AUDIO);
    };
  }, [enabled, setEnabled]);
}
