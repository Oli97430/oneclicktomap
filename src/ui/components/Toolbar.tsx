import { useRef, type ChangeEvent } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { openProjectFromFile, saveProjectToFile } from '@/io/projectActions';
import { OutputControls } from './OutputControls';

export function Toolbar() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resetSurface = useProjectStore((s) => s.resetSurface);
  const addLayer = useProjectStore((s) => s.addLayer);
  const selectedSurfaceId = useProjectStore((s) => s.selectedSurfaceId);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const canUndo = useProjectStore((s) => s.past.length > 0);
  const canRedo = useProjectStore((s) => s.future.length > 0);

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedSurfaceId) return;
    const reader = new FileReader();
    reader.onload = () =>
      addLayer(selectedSurfaceId, { kind: 'image', dataUrl: reader.result as string }, file.name);
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  return (
    <header className="toolbar">
      <div className="toolbar-brand">
        <span className="toolbar-logo" aria-hidden="true">
          ◳
        </span>
        <span>OneClickToMap</span>
        <span className="toolbar-badge">Phase 7</span>
      </div>

      <div className="toolbar-actions">
        <button type="button" onClick={undo} disabled={!canUndo} title="Annuler (Ctrl+Z)">
          ↶
        </button>
        <button type="button" onClick={redo} disabled={!canRedo} title="Rétablir (Ctrl+Maj+Z)">
          ↷
        </button>
        <span className="toolbar-divider" />
        <button
          type="button"
          onClick={() => void openProjectFromFile()}
          title="Ouvrir un projet (Ctrl+O)"
        >
          Ouvrir…
        </button>
        <button
          type="button"
          onClick={() => void saveProjectToFile()}
          title="Enregistrer le projet (Ctrl+S)"
        >
          Enregistrer…
        </button>
        <span className="toolbar-divider" />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={!selectedSurfaceId}
        >
          Ajouter une image…
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          aria-label="Importer une image"
          onChange={handleFile}
        />
        <button type="button" onClick={() => selectedSurfaceId && resetSurface(selectedSurfaceId)}>
          Réinitialiser
        </button>
      </div>

      <OutputControls />

      <div className="toolbar-hint">
        <span>Glissez les points · Ctrl+Z / Ctrl+Y pour annuler / rétablir</span>
      </div>
    </header>
  );
}
