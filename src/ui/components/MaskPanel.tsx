import { useProjectStore } from '@/stores/projectStore';

export function MaskPanel() {
  const surfaces = useProjectStore((s) => s.project.surfaces);
  const selectedSurfaceId = useProjectStore((s) => s.selectedSurfaceId);
  const toggleMask = useProjectStore((s) => s.toggleMask);
  const addMaskPoint = useProjectStore((s) => s.addMaskPoint);

  const surface = surfaces.find((s) => s.id === selectedSurfaceId);
  if (!surface) {
    return (
      <section className="panel">
        <h2 className="panel-title">Masque</h2>
        <p className="panel-hint">Aucune surface sélectionnée.</p>
      </section>
    );
  }

  const enabled = surface.mask?.enabled ?? false;
  const count = surface.mask?.points.length ?? 0;

  return (
    <section className="panel">
      <h2 className="panel-title">Masque · {surface.name}</h2>
      <button
        type="button"
        className={`panel-action${enabled ? ' is-active' : ''}`}
        onClick={() => toggleMask(surface.id)}
      >
        {enabled ? 'Masque activé' : 'Masque désactivé'}
      </button>

      {enabled ? (
        <div className="grid-size">
          <button type="button" className="panel-action" onClick={() => addMaskPoint(surface.id)}>
            + Ajouter un point
          </button>
          <p className="panel-hint">
            {count} points · glissez les poignées magenta, double-clic pour en retirer.
          </p>
        </div>
      ) : (
        <p className="panel-hint">
          Active un masque pour découper la surface selon une courbe fermée lisse.
        </p>
      )}
    </section>
  );
}
