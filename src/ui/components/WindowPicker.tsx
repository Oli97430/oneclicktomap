import { useEffect, useState } from 'react';
import type { DesktopSource } from '../../../shared/contract';

interface WindowPickerProps {
  onPick: (source: DesktopSource) => void;
  onClose: () => void;
}

/**
 * Sélecteur de capture : liste les écrans et fenêtres ouvertes (vignettes +
 * noms via desktopCapturer) pour les ajouter en calque. Le rendu se fait ensuite
 * en flux continu (getUserMedia → VideoTexture), comme une webcam.
 */
export function WindowPicker({ onPick, onClose }: WindowPickerProps) {
  const [sources, setSources] = useState<DesktopSource[] | null>(null);
  const [error, setError] = useState(false);

  const load = () => {
    setSources(null);
    setError(false);
    window.oneClickToMap
      ?.getDesktopSources()
      .then((list) => setSources(list))
      .catch(() => setError(true));
  };

  useEffect(() => {
    load();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const screens = sources?.filter((s) => s.kind === 'screen') ?? [];
  const windows = sources?.filter((s) => s.kind === 'window') ?? [];

  const renderGroup = (title: string, items: DesktopSource[]) =>
    items.length > 0 && (
      <>
        <h3 className="window-picker-group">{title}</h3>
        <div className="window-picker-grid">
          {items.map((s) => (
            <button
              key={s.id}
              type="button"
              className="window-picker-item"
              onClick={() => onPick(s)}
              title={s.name}
            >
              <img src={s.thumbnail} alt="" className="window-picker-thumb" />
              <span className="window-picker-name">{s.name}</span>
            </button>
          ))}
        </div>
      </>
    );

  return (
    <div
      className="window-picker-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Choisir une fenêtre ou un écran"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="window-picker">
        <div className="window-picker-head">
          <h2 className="panel-title">Capturer une fenêtre / un écran</h2>
          <div className="panel-head-actions">
            <button type="button" className="icon-btn" onClick={load} title="Rafraîchir" aria-label="Rafraîchir">
              ↻
            </button>
            <button type="button" className="icon-btn" onClick={onClose} title="Fermer" aria-label="Fermer">
              ×
            </button>
          </div>
        </div>

        {error && <p className="panel-hint">Impossible de lister les sources.</p>}
        {!error && sources === null && <p className="panel-hint">Recherche des fenêtres…</p>}
        {!error && sources !== null && sources.length === 0 && (
          <p className="panel-hint">Aucune source capturable.</p>
        )}

        <div className="window-picker-body">
          {renderGroup('Écrans', screens)}
          {renderGroup('Fenêtres', windows)}
        </div>
      </div>
    </div>
  );
}
