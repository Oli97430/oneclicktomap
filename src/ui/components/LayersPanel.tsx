import { useProjectStore } from '@/stores/projectStore';
import type { BlendMode } from '@/types';

const BLEND_LABELS: Record<BlendMode, string> = {
  normal: 'Normal',
  add: 'Addition',
  multiply: 'Multiplier',
  screen: 'Écran',
};

export function LayersPanel() {
  const surfaces = useProjectStore((s) => s.project.surfaces);
  const selectedSurfaceId = useProjectStore((s) => s.selectedSurfaceId);
  const selectedLayerId = useProjectStore((s) => s.selectedLayerId);
  const selectLayer = useProjectStore((s) => s.selectLayer);
  const removeLayer = useProjectStore((s) => s.removeLayer);
  const moveLayer = useProjectStore((s) => s.moveLayer);
  const setLayerBlend = useProjectStore((s) => s.setLayerBlend);
  const toggleLayerVisible = useProjectStore((s) => s.toggleLayerVisible);
  const setLayerOpacityTransient = useProjectStore((s) => s.setLayerOpacityTransient);
  const beginDrag = useProjectStore((s) => s.beginDrag);
  const endDrag = useProjectStore((s) => s.endDrag);

  const surface = surfaces.find((s) => s.id === selectedSurfaceId);
  if (!surface) {
    return (
      <section className="panel">
        <h2 className="panel-title">Calques</h2>
        <p className="panel-hint">Aucune surface sélectionnée.</p>
      </section>
    );
  }

  const count = surface.layers.length;
  // Affichage du haut (sommet de pile) vers le bas.
  const rows = surface.layers.map((layer, index) => ({ layer, index })).reverse();

  return (
    <section className="panel">
      <h2 className="panel-title">Calques · {surface.name}</h2>
      <ul className="layer-list">
        {rows.map(({ layer, index }) => (
          <li
            key={layer.id}
            className={`layer-row${layer.id === selectedLayerId ? ' is-selected' : ''}`}
          >
            <div className="layer-head">
              <button
                type="button"
                className="surface-vis"
                onClick={() => toggleLayerVisible(surface.id, layer.id)}
                title={layer.visible ? 'Masquer' : 'Afficher'}
                aria-label={layer.visible ? 'Masquer le calque' : 'Afficher le calque'}
              >
                {layer.visible ? '◉' : '○'}
              </button>
              <button
                type="button"
                className={`surface-name${layer.visible ? '' : ' is-hidden'}`}
                onClick={() => selectLayer(layer.id)}
              >
                {layer.name}
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => moveLayer(surface.id, layer.id, 1)}
                disabled={index === count - 1}
                title="Monter"
                aria-label="Monter le calque"
              >
                ↑
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => moveLayer(surface.id, layer.id, -1)}
                disabled={index === 0}
                title="Descendre"
                aria-label="Descendre le calque"
              >
                ↓
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => removeLayer(surface.id, layer.id)}
                disabled={count <= 1}
                title="Supprimer"
                aria-label="Supprimer le calque"
              >
                ×
              </button>
            </div>
            <div className="layer-controls">
              <select
                className="layer-blend"
                value={layer.blendMode}
                onChange={(e) => setLayerBlend(surface.id, layer.id, e.target.value as BlendMode)}
                aria-label="Mode de fusion"
              >
                {(Object.keys(BLEND_LABELS) as BlendMode[]).map((mode) => (
                  <option key={mode} value={mode}>
                    {BLEND_LABELS[mode]}
                  </option>
                ))}
              </select>
              <input
                className="layer-opacity"
                type="range"
                min={0}
                max={100}
                value={Math.round(layer.opacity * 100)}
                onPointerDown={() => beginDrag()}
                onKeyDown={() => beginDrag()}
                onChange={(e) =>
                  setLayerOpacityTransient(surface.id, layer.id, Number(e.target.value) / 100)
                }
                onPointerUp={() => endDrag()}
                onKeyUp={() => endDrag()}
                onBlur={() => endDrag()}
                title={`Opacité ${Math.round(layer.opacity * 100)}%`}
                aria-label="Opacité"
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
