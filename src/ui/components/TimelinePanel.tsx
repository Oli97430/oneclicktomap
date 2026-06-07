import { useSceneStore } from '@/stores/sceneStore';
import { timelineDurationMs } from '@/timeline/timeline';
import type { TransitionKind } from '@/types';

function formatMs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Affichage de l'horloge isolé (re-rendu chaque frame sans toucher la liste). */
function TimelineClock() {
  const positionMs = useSceneStore((s) => s.positionMs);
  const scenes = useSceneStore((s) => s.scenes);
  return (
    <span className="timeline-clock">
      {formatMs(positionMs)} / {formatMs(timelineDurationMs(scenes))}
    </span>
  );
}

const TRANSITIONS: { value: TransitionKind; label: string }[] = [
  { value: 'cut', label: 'Coupe' },
  { value: 'fade', label: 'Fondu' },
  { value: 'morph', label: 'Morph' },
];

export function TimelinePanel() {
  const scenes = useSceneStore((s) => s.scenes);
  const activeSceneId = useSceneStore((s) => s.activeSceneId);
  const playing = useSceneStore((s) => s.playing);
  const loop = useSceneStore((s) => s.loop);
  const bpm = useSceneStore((s) => s.bpm);

  const captureScene = useSceneStore((s) => s.captureScene);
  const applyScene = useSceneStore((s) => s.applyScene);
  const updateScene = useSceneStore((s) => s.updateScene);
  const deleteScene = useSceneStore((s) => s.deleteScene);
  const moveScene = useSceneStore((s) => s.moveScene);
  const play = useSceneStore((s) => s.play);
  const pause = useSceneStore((s) => s.pause);
  const stop = useSceneStore((s) => s.stop);
  const toggleLoop = useSceneStore((s) => s.toggleLoop);
  const setBpm = useSceneStore((s) => s.setBpm);
  const tap = useSceneStore((s) => s.tap);
  const quantizeToBpm = useSceneStore((s) => s.quantizeToBpm);
  const togglePerformanceMode = useSceneStore((s) => s.togglePerformanceMode);

  return (
    <section className="panel">
      <h2 className="panel-title">Timeline &amp; scènes</h2>

      <button type="button" className="panel-action" onClick={captureScene}>
        + Capturer la scène
      </button>

      <div className="transport">
        <button type="button" onClick={stop} title="Stop" aria-label="Stop">
          ⏹
        </button>
        <button
          type="button"
          onClick={playing ? pause : play}
          disabled={scenes.length === 0}
          title={playing ? 'Pause' : 'Lecture'}
          aria-label={playing ? 'Pause' : 'Lecture'}
        >
          {playing ? '⏸' : '▶'}
        </button>
        <button
          type="button"
          className={loop ? 'is-active' : ''}
          onClick={toggleLoop}
          title="Boucle"
          aria-label="Boucle"
        >
          ⟳
        </button>
        <TimelineClock />
      </div>

      <div className="bpm-row">
        <label>
          BPM
          <input
            type="number"
            min={20}
            max={300}
            value={Math.round(bpm)}
            onChange={(e) => setBpm(Number(e.target.value))}
          />
        </label>
        <button type="button" className="panel-action" onClick={() => tap(performance.now())}>
          Tap
        </button>
        <button
          type="button"
          className="panel-action"
          onClick={quantizeToBpm}
          disabled={scenes.length === 0}
          title="Caler les durées des scènes sur le tempo"
        >
          Caler
        </button>
      </div>

      {scenes.length === 0 ? (
        <p className="panel-hint">
          Réglez vos surfaces puis « Capturer la scène » pour créer des instantanés à enchaîner.
        </p>
      ) : (
        <ul className="scene-list">
          {scenes.map((scene, i) => (
            <li
              key={scene.id}
              className={`scene-row${scene.id === activeSceneId ? ' is-active' : ''}`}
            >
              <div className="scene-row-head">
                <span className="scene-index">{i + 1}</span>
                <button
                  type="button"
                  className="scene-name"
                  onClick={() => applyScene(scene.id)}
                  title="Appliquer cette scène"
                >
                  {scene.name}
                </button>
                <button
                  type="button"
                  onClick={() => moveScene(scene.id, -1)}
                  disabled={i === 0}
                  title="Monter"
                  aria-label="Monter"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => moveScene(scene.id, 1)}
                  disabled={i === scenes.length - 1}
                  title="Descendre"
                  aria-label="Descendre"
                >
                  ▼
                </button>
                <button
                  type="button"
                  onClick={() => deleteScene(scene.id)}
                  title="Supprimer"
                  aria-label="Supprimer"
                >
                  ✕
                </button>
              </div>
              <div className="scene-row-params">
                <label>
                  Hold
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={scene.holdMs / 1000}
                    onChange={(e) =>
                      updateScene(scene.id, { holdMs: Math.max(0, Number(e.target.value) * 1000) })
                    }
                  />
                  s
                </label>
                <label>
                  Trans
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={scene.transitionMs}
                    onChange={(e) =>
                      updateScene(scene.id, { transitionMs: Math.max(0, Number(e.target.value)) })
                    }
                  />
                  ms
                </label>
                <select
                  value={scene.transition}
                  onChange={(e) =>
                    updateScene(scene.id, { transition: e.target.value as TransitionKind })
                  }
                  aria-label="Type de transition"
                >
                  {TRANSITIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        className="panel-action"
        style={{ marginTop: 8 }}
        onClick={togglePerformanceMode}
      >
        Mode performance
      </button>
    </section>
  );
}
