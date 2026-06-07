import { useProjectStore } from '@/stores/projectStore';

export function SurfaceList() {
  const surfaces = useProjectStore((s) => s.project.surfaces);
  const selectedSurfaceId = useProjectStore((s) => s.selectedSurfaceId);
  // A1 : selection multiple
  const selectedSurfaceIds = useProjectStore((s) => s.selectedSurfaceIds);
  const select = useProjectStore((s) => s.selectSurface);
  const addToSelection = useProjectStore((s) => s.addToSelection);
  const deleteSelectedSurfaces = useProjectStore((s) => s.deleteSelectedSurfaces);
  const add = useProjectStore((s) => s.addSurface);
  const remove = useProjectStore((s) => s.removeSurface);
  const duplicate = useProjectStore((s) => s.duplicateSurface);
  const toggleVisible = useProjectStore((s) => s.toggleSurfaceVisible);
  const setSurfaceOutput = useProjectStore((s) => s.setSurfaceOutput);

  const multiSelected = selectedSurfaceIds.length > 1;

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Surfaces</h2>
        <div className="panel-head-actions">
          {multiSelected && (
            <button
              type="button"
              className="icon-btn icon-btn-danger"
              onClick={deleteSelectedSurfaces}
              title={`Supprimer ${selectedSurfaceIds.length} surfaces sélectionnées`}
              aria-label="Supprimer la sélection"
            >
              ×
            </button>
          )}
          <button type="button" className="icon-btn" onClick={add} title="Ajouter une surface">
            ＋
          </button>
        </div>
      </div>

      <ul className="surface-list">
        {surfaces.map((surface) => {
          const isPrimary = surface.id === selectedSurfaceId;
          const isSelected = selectedSurfaceIds.includes(surface.id);
          return (
            <li
              key={surface.id}
              className={[
                'surface-row',
                isPrimary ? 'is-selected' : '',
                isSelected && !isPrimary ? 'is-multi-selected' : '',
              ]
                .filter(Boolean)
                .join(' ')}
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
                onClick={(e) => {
                  if (e.shiftKey) {
                    // A1 : shift-click = multi-selection
                    addToSelection(surface.id);
                  } else {
                    select(surface.id);
                  }
                }}
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
          );
        })}
      </ul>
    </section>
  );
}
