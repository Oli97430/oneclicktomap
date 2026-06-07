import { useSceneStore } from '@/stores/sceneStore';

export function CueBar() {
  const scenes = useSceneStore((s) => s.scenes);
  const activeSceneId = useSceneStore((s) => s.activeSceneId);
  const performanceMode = useSceneStore((s) => s.performanceMode);
  const loop = useSceneStore((s) => s.loop);
  const goToScene = useSceneStore((s) => s.goToScene);
  const nextCue = useSceneStore((s) => s.nextCue);
  const prevCue = useSceneStore((s) => s.prevCue);
  const togglePerformanceMode = useSceneStore((s) => s.togglePerformanceMode);

  // Masqué tant qu'aucune scène n'existe (sauf en mode performance, pour pouvoir sortir).
  if (scenes.length === 0 && !performanceMode) return null;

  const activeIndex = scenes.findIndex((s) => s.id === activeSceneId);
  const active = activeIndex >= 0 ? scenes[activeIndex] : null;
  let nextIndex = activeIndex + 1;
  if (nextIndex >= scenes.length) nextIndex = loop ? 0 : scenes.length - 1;
  const next = scenes[nextIndex] ?? null;

  return (
    <div className={`cue-bar${performanceMode ? ' is-performance' : ''}`}>
      <button
        type="button"
        className="cue-nav"
        onClick={prevCue}
        disabled={scenes.length === 0}
        aria-label="Cue précédent"
      >
        ◀
      </button>

      <button
        type="button"
        className="cue-go"
        onClick={nextCue}
        disabled={scenes.length === 0}
        title="Cue suivant (Espace / →)"
      >
        GO
        <span className="cue-go-sub">
          {active ? active.name : '—'} → {next ? next.name : '—'}
        </span>
      </button>

      <button
        type="button"
        className="cue-nav"
        onClick={nextCue}
        disabled={scenes.length === 0}
        aria-label="Cue suivant"
      >
        ▶
      </button>

      <div className="cue-chips">
        {scenes.map((scene, i) => (
          <button
            key={scene.id}
            type="button"
            className={`cue-chip${scene.id === activeSceneId ? ' is-active' : ''}`}
            onClick={() => goToScene(i)}
            title={scene.name}
          >
            {i + 1}
          </button>
        ))}
      </div>

      <button
        type="button"
        className={`cue-perf${performanceMode ? ' is-active' : ''}`}
        onClick={togglePerformanceMode}
      >
        {performanceMode ? 'Quitter (Échap)' : 'Performance'}
      </button>
    </div>
  );
}
