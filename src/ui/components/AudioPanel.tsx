import { useEffect, useRef } from 'react';
import { useAudioStore } from '@/stores/audioStore';
import { getAudioFeatures } from '@/content/audioBus';

export function AudioPanel() {
  const enabled = useAudioStore((s) => s.enabled);
  const toggle = useAudioStore((s) => s.toggle);
  const meterRef = useRef<HTMLDivElement>(null);

  // Met à jour les barres du VU-mètre via rAF (lecture directe du bus, sans churn React).
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = requestAnimationFrame(update);
      const el = meterRef.current;
      if (!el) return;
      const f = getAudioFeatures();
      const values = [f.level, f.bass, f.mid, f.treble];
      const bars = el.children;
      for (let i = 0; i < bars.length && i < values.length; i += 1) {
        (bars[i] as HTMLElement).style.height = `${Math.min(100, values[i] * 140)}%`;
      }
    };
    update();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <section className="panel">
      <h2 className="panel-title">Audio réactif</h2>
      <button
        type="button"
        className={`panel-action${enabled ? ' is-active' : ''}`}
        onClick={toggle}
      >
        {enabled ? 'Audio actif' : 'Activer l’audio (micro)'}
      </button>
      <div className="audio-meter" ref={meterRef} aria-hidden="true">
        <div className="audio-bar" />
        <div className="audio-bar" />
        <div className="audio-bar" />
        <div className="audio-bar" />
      </div>
      <p className="panel-hint">
        Pilote les calques génératifs (uLevel / uBass / uMid / uTreble / uBeat) et les particules.
      </p>
    </section>
  );
}
