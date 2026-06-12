import { useState, useSyncExternalStore } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { getMediaStatus, subscribeMediaStatus } from '@/utils/mediaStatusBus';
import type { BlendMode } from '@/types';
import { WindowPicker } from './WindowPicker';

// A4 : tous les blend modes (Phase 2 + Phase 9)
const BLEND_LABELS: Record<BlendMode, string> = {
  normal: 'Normal',
  add: 'Addition',
  multiply: 'Multiplier',
  screen: 'Ecran',
  overlay: 'Incrustation',
  softlight: 'Lumiere tamisee',
  difference: 'Difference',
  colordodge: 'Eclaircir',
};

/** G2 : indicateur de statut réel pour les calques video/webcam/stream. */
function LoadingBadge({ kind, layerId }: { kind: string; layerId: string }) {
  const needsIndicator =
    kind === 'video' ||
    kind === 'webcam' ||
    kind === 'stream' ||
    kind === 'web' ||
    kind === 'window';
  // Hook appelé inconditionnellement (règle des hooks) ; ignoré si non pertinent.
  const status = useSyncExternalStore(
    subscribeMediaStatus,
    () => getMediaStatus(layerId),
  );
  if (!needsIndicator) return null;

  if (status === 'error') {
    const hint =
      kind === 'video'
        ? 'Échec de lecture — codec non supporté. Convertis la vidéo en MP4 (H.264) ou WebM (VP9).'
        : kind === 'webcam'
          ? 'Accès caméra refusé ou indisponible.'
          : kind === 'web'
            ? 'Page web indisponible (chemin ou URL).'
            : kind === 'window'
              ? 'Capture indisponible (fenêtre fermée ?).'
              : 'Flux indisponible (URL ou format).';
    return (
      <span className="layer-loading layer-status-error" data-layer-id={layerId} title={hint} aria-label={hint}>
        ⚠️
      </span>
    );
  }
  if (status === 'loading') {
    return (
      <span className="layer-loading" data-layer-id={layerId} title="Chargement…" aria-label="Chargement en cours">
        ⏳
      </span>
    );
  }
  // ready : pas d'indicateur (le contenu est visible).
  return null;
}

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
  // C4 / C6 : ajout de nouveaux types
  const addTextLayer = useProjectStore((s) => s.addTextLayer);
  const addStreamLayer = useProjectStore((s) => s.addStreamLayer);
  const addWebLayer = useProjectStore((s) => s.addWebLayer);
  const addWindowLayer = useProjectStore((s) => s.addWindowLayer);

  // C6 : saisie d'URL de flux
  const [streamUrl, setStreamUrl] = useState('');
  const [showStreamInput, setShowStreamInput] = useState(false);
  // Sélecteur de capture de fenêtre / écran
  const [showWindowPicker, setShowWindowPicker] = useState(false);

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

  const handleAddStream = () => {
    const url = streamUrl.trim();
    if (!url) return;
    addStreamLayer(surface.id, url);
    setStreamUrl('');
    setShowStreamInput(false);
  };

  // Source web : sélecteur de fichier HTML local (rendu hors-écran).
  const handleAddWeb = async () => {
    const result = await window.oneClickToMap?.pickWebSource();
    if (result?.path) {
      const name = result.path.split(/[\\/]/).pop() || 'Page web';
      addWebLayer(surface.id, result.path, name);
    }
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Calques · {surface.name}</h2>
        <div className="panel-head-actions">
          {/* C4 */}
          <button
            type="button"
            className="icon-btn"
            onClick={() => addTextLayer(surface.id)}
            title="Ajouter un calque texte"
            aria-label="Calque texte"
          >
            T
          </button>
          {/* C6 */}
          <button
            type="button"
            className="icon-btn"
            onClick={() => setShowStreamInput((v) => !v)}
            title="Ajouter un flux HLS/RTSP"
            aria-label="Calque flux"
            aria-expanded={showStreamInput}
          >
            📡
          </button>
          {/* Source web (HTML/URL rendu hors-écran) */}
          <button
            type="button"
            className="icon-btn"
            onClick={handleAddWeb}
            title="Ajouter une page web (HTML : viewer 3D, shader, SuperSplat…)"
            aria-label="Calque page web"
          >
            🌐
          </button>
          {/* Capture de fenêtre / écran */}
          <button
            type="button"
            className="icon-btn"
            onClick={() => setShowWindowPicker(true)}
            title="Capturer une fenêtre ou un écran en calque"
            aria-label="Calque capture de fenêtre"
          >
            🖥️
          </button>
        </div>
      </div>

      {showWindowPicker && (
        <WindowPicker
          onPick={(source) => {
            addWindowLayer(surface.id, source.id, source.name);
            setShowWindowPicker(false);
          }}
          onClose={() => setShowWindowPicker(false)}
        />
      )}

      {/* C6 : saisie d'URL */}
      {showStreamInput && (
        <div className="stream-input-row">
          <input
            type="url"
            className="stream-url-input"
            placeholder="https://… ou rtsp://…"
            value={streamUrl}
            onChange={(e) => setStreamUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddStream();
              if (e.key === 'Escape') setShowStreamInput(false);
            }}
            aria-label="URL du flux"
            autoFocus
          />
          <button
            type="button"
            className="icon-btn"
            onClick={handleAddStream}
            disabled={!streamUrl.trim()}
            aria-label="Ajouter le flux"
          >
            ✓
          </button>
        </div>
      )}

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
              {/* G2 : indicateur de chargement */}
              <LoadingBadge kind={layer.source.kind} layerId={layer.id} />
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
                title={`Opacite ${Math.round(layer.opacity * 100)}%`}
                aria-label="Opacité"
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
