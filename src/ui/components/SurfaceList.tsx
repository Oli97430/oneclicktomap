import { useProjectStore } from '@/stores/projectStore';

export function SurfaceList() {
  const surfaces = useProjectStore((s) => s.project.surfaces);
  const selectedSurfaceId = useProjectStore((s) => s.selectedSurfaceId);
  const select = useProjectStore((s) => s.selectSurface);
  const add = useProjectStore((s) => s.addSurface);
  const remove = useProjectStore((s) => s.removeSurface);
  const duplicate = useProjectStore((s) => s.duplicateSurface);
  const toggleVisible = useProjectStore((s) => s.toggleSurfaceVisible);
  const setSurfaceOutput = useProjectStore((s) => s.setSurfaceOutput);

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Surfaces</h2>
        <button type="button" className="icon-btn" onClick={add} title="Ajouter une surface">
          ＋
        </button>
      </div>

      <ul className="surface-list">
        {surfaces.map((surface) => (
          <li
            key={surface.id}
            className={`surface-row${surface.id === selectedSurfaceId ? ' is-selected' : ''}`}
          >
            <button
              type="button"
              className="surface-vis"
              onClick={() => toggleVisible(surface.id)}
              title={surface.visible ? 'Masquer' : 'Afficher'}
              aria-label={surface.visible ? 'Masquer la surface' : 'Afficher la surface'}
            >
              {surface.visible ? '◉' : '○'}
            </button>
            <button
              type="button"
              className={`surface-name${surface.visible ? '' : ' is-hidden'}`}
              onClick={() => select(surface.id)}
            >
              {surface.name}
            </button>
            <select
              className="surface-output"
              value={surface.output}
              onChange={(e) => setSurfaceOutput(surface.id, Number(e.target.value))}
              title="Sortie (projecteur) affectée"
              aria-label="Sortie affectée"
            >
              {[0, 1, 2, 3].map((i) => (
                <option key={i} value={i}>
                  S{i + 1}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="icon-btn"
              onClick={() => duplicate(surface.id)}
              title="Dupliquer"
              aria-label="Dupliquer la surface"
            >
              ⧉
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => remove(surface.id)}
              title="Supprimer"
              aria-label="Supprimer la surface"
              disabled={surfaces.length <= 1}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
