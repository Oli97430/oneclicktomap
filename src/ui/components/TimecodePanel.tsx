/**
 * F1 - Panneau Timecode SMPTE (MTC via MIDI, LTC via audio).
 * Affiche le timecode entrant en temps reel et permet de le synchroniser
 * avec la timeline (seek sur la position courante).
 */
import { useEffect, useRef, useState } from 'react';
import { useSceneStore } from '@/stores/sceneStore';
import {
  decodeMTC,
  listMIDIInputs,
  createLTCDecoder,
  type TimecodeFrame,
} from '@/utils/timecode';

type SourceMode = 'none' | 'mtc' | 'ltc';

function formatTC(tc: TimecodeFrame): string {
  const pad = (n: number) => String(Math.floor(n)).padStart(2, '0');
  return `${pad(tc.hours)}:${pad(tc.minutes)}:${pad(tc.seconds)}:${pad(tc.frames)}`;
}

export function TimecodePanel() {
  const [mode, setMode] = useState<SourceMode>('none');
  const [midiInputs, setMidiInputs] = useState<MIDIInput[]>([]);
  const [selectedMidi, setSelectedMidi] = useState<string>('');
  const [tc, setTc] = useState<TimecodeFrame | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanupRef = useRef<(() => void) | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const ltcNodeRef = useRef<{ disconnect: () => void } | null>(null);
  const ltcStreamRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const seekMs = useSceneStore((s) => s.seek);

  // Charge les entrees MIDI disponibles.
  useEffect(() => {
    listMIDIInputs().then(setMidiInputs).catch(() => setMidiInputs([]));
  }, []);

  // Nettoie lors du changement de mode.
  const stop = () => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    ltcNodeRef.current?.disconnect();
    ltcNodeRef.current = null;
    ltcStreamRef.current?.disconnect();
    ltcStreamRef.current = null;
    if (audioCtxRef.current) {
      void audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    setTc(null);
  };

  // Demarrage MTC.
  const startMTC = () => {
    setError(null);
    const input = midiInputs.find((i) => i.id === selectedMidi) ?? midiInputs[0];
    if (!input) {
      setError('Aucune entree MIDI disponible.');
      return;
    }
    const off = decodeMTC(input, (frame) => setTc(frame));
    cleanupRef.current = off;
  };

  // Demarrage LTC.
  const startLTC = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      ltcStreamRef.current = source;
      const { node, disconnect } = await createLTCDecoder(ctx, (frame) => setTc(frame));
      source.connect(node);
      ltcNodeRef.current = { disconnect };
    } catch (err) {
      setError(`Erreur LTC : ${err instanceof Error ? err.message : String(err)}`);
      stop();
    }
  };

  const handleModeChange = (newMode: SourceMode) => {
    stop();
    setMode(newMode);
    if (newMode === 'mtc') startMTC();
    else if (newMode === 'ltc') void startLTC();
  };

  // Synchronise la position de la timeline avec le timecode recu.
  useEffect(() => {
    if (syncing && tc) seekMs(tc.totalSeconds * 1000);
  }, [tc, syncing, seekMs]);

  useEffect(() => () => stop(), []);

  const hasSeek = true;

  return (
    <section className="panel timecode-panel">
      <h2 className="panel-title">Timecode</h2>

      <div className="tc-source-row">
        <label className="text-ctrl-label">
          Source
          <select
            value={mode}
            onChange={(e) => handleModeChange(e.target.value as SourceMode)}
            aria-label="Source timecode"
          >
            <option value="none">Aucune</option>
            <option value="mtc">MTC (MIDI)</option>
            <option value="ltc">LTC (audio)</option>
          </select>
        </label>

        {mode === 'mtc' && midiInputs.length > 1 && (
          <label className="text-ctrl-label">
            Entree MIDI
            <select
              value={selectedMidi}
              onChange={(e) => setSelectedMidi(e.target.value)}
              aria-label="Entree MIDI"
            >
              {midiInputs.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name ?? i.id}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {error && <p className="panel-hint panel-error">{error}</p>}

      <div className="tc-display" aria-live="polite" aria-label="Timecode courant">
        {tc ? (
          <>
            <span className="tc-value">{formatTC(tc)}</span>
            <span className="tc-fps">{tc.frameRate} fps</span>
          </>
        ) : (
          <span className="tc-value tc-idle">--:--:--:--</span>
        )}
      </div>

      {hasSeek && (
        <label className="text-ctrl-label text-ctrl-check" style={{ marginTop: 8 }}>
          <input
            type="checkbox"
            checked={syncing}
            onChange={(e) => setSyncing(e.target.checked)}
            disabled={mode === 'none'}
            aria-label="Synchroniser avec la timeline"
          />
          Synchroniser avec la timeline
        </label>
      )}

      <p className="panel-hint">
        MTC requiert une entree MIDI connectee (Web MIDI API). LTC lit un signal audio analogique
        via le micro / entree ligne.
      </p>
    </section>
  );
}
