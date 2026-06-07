import { useProjectStore } from '@/stores/projectStore';
import type { WarpMode } from '@/types';

const GRID_MIN = 1;
const GRID_MAX = 8;
const clampGrid = (value: number) => Math.max(GRID_MIN, Math.min(GRID_MAX, value));

interface StepperProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

function Stepper({ label, value, onChange }: StepperProps) {
  return (
    <div className="stepper">
      <span className="stepper-label">{label}</span>
      <div className="stepper-controls">
        <button
          type="button"
          onClick={() => onChange(clampGrid(value - 1))}
          disabled={value <= GRID_MIN}
          aria-label={`${label} moins`}
        >
          −
        </button>
        <span className="stepper-value">{value}</span>
        <button
          type="button"
          onClick={() => onChange(clampGrid(value + 1))}
          disabled={value >= GRID_MAX}
          aria-label={`${label} plus`}
        >
          +
        </button>
      </div>
    </div>
  );
}

export function WarpControls() {
  const surfaces = useProjectStore((s) => s.project.surfaces);
  const selectedSurfaceId = useProjectStore((s) => s.selectedSurfaceId);
  const setWarpMode = useProjectStore((s) => s.setWarpMode);
  const setGridSize = useProjectStore((s) => s.setGridSize);

  const surface = surfaces.find((s) => s.id === selectedSurfaceId);
  if (!surface) {
    return (
      <section className="panel">
        <h2 className="panel-title">Déformation</h2>
        <p className="panel-hint">Aucune surface sélectionnée.</p>
      </section>
    );
  }

  const size = surface.gridSize ?? { cols: 3, rows: 3 };
  const choose = (mode: WarpMode) => setWarpMode(surface.id, mode);

  return (
    <section className="panel">
      <h2 className="panel-title">Déformation · {surface.name}</h2>

      <div className="seg" role="group" aria-label="Mode de déformation">
        <button
          type="button"
          className={surface.warpMode === 'quad' ? 'is-active' : ''}
          onClick={() => choose('quad')}
        >
          Quad
        </button>
        <button
          type="button"
          className={surface.warpMode === 'grid' ? 'is-active' : ''}
          onClick={() => choose('grid')}
        >
          Grille
        </button>
      </div>

      {surface.warpMode === 'grid' && (
        <div className="grid-size">
          <Stepper
            label="Colonnes"
            value={size.cols}
            onChange={(cols) => setGridSize(surface.id, { cols, rows: size.rows })}
          />
          <Stepper
            label="Lignes"
            value={size.rows}
            onChange={(rows) => setGridSize(surface.id, { cols: size.cols, rows })}
          />
          <p className="panel-hint">
            {(size.cols + 1) * (size.rows + 1)} points · glissez-les pour déformer le maillage.
          </p>
        </div>
      )}

      {surface.warpMode === 'quad' && (
        <p className="panel-hint">
          4 coins, correction de perspective. Passez en grille pour un maillage déformable.
        </p>
      )}
    </section>
  );
}
