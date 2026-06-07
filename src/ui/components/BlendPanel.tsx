import { useProjectStore } from '@/stores/projectStore';
import type { BlendZone } from '@/types';

const EDGES: { edge: BlendZone['edge']; label: string }[] = [
  { edge: 'left', label: 'Gauche' },
  { edge: 'right', label: 'Droite' },
  { edge: 'top', label: 'Haut' },
  { edge: 'bottom', label: 'Bas' },
];

const DEFAULT_GAMMA = 1.8;

export function BlendPanel() {
  const surfaces = useProjectStore((s) => s.project.surfaces);
  const selectedSurfaceId = useProjectStore((s) => s.selectedSurfaceId);
  const setBlendEdgeTransient = useProjectStore((s) => s.setBlendEdgeTransient);
  const beginDrag = useProjectStore((s) => s.beginDrag);
  const endDrag = useProjectStore((s) => s.endDrag);

  const surface = surfaces.find((s) => s.id === selectedSurfaceId);

  if (!surface) {
    return (
      <section className="panel">
        <h2 className="panel-title">Edge blending</h2>
        <p className="panel-hint">Sélectionnez une surface.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2 className="panel-title">Edge blending</h2>
      <div className="blend-grid">
        {EDGES.map(({ edge, label }) => {
          const zone = surface.blendZones.find((z) => z.edge === edge);
          const size = zone?.size ?? 0;
          const gamma = zone?.gamma ?? DEFAULT_GAMMA;
          return (
            <div key={edge} className="blend-edge">
              <span className="blend-edge-label">{label}</span>
              <label className="blend-ctl">
                Fondu
                <input
                  type="range"
                  min={0}
                  max={0.5}
                  step={0.01}
                  value={size}
                  onPointerDown={beginDrag}
                  onPointerUp={endDrag}
                  onFocus={beginDrag}
                  onBlur={endDrag}
                  onChange={(e) =>
                    setBlendEdgeTransient(surface.id, edge, Number(e.target.value), gamma)
                  }
                />
                <span className="blend-val">{Math.round(size * 100)}%</span>
              </label>
              <label className="blend-ctl">
                Gamma
                <input
                  type="range"
                  min={0.5}
                  max={3}
                  step={0.1}
                  value={gamma}
                  disabled={size <= 0}
                  onPointerDown={beginDrag}
                  onPointerUp={endDrag}
                  onFocus={beginDrag}
                  onBlur={endDrag}
                  onChange={(e) =>
                    setBlendEdgeTransient(surface.id, edge, size, Number(e.target.value))
                  }
                />
                <span className="blend-val">{gamma.toFixed(1)}</span>
              </label>
            </div>
          );
        })}
      </div>
      <p className="panel-hint">
        Adoucit les bords pour fondre le recouvrement entre projecteurs voisins.
      </p>
    </section>
  );
}
