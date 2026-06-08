import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useLiveStore } from '@/stores/liveStore';
import { openProjectFromFile, saveProjectToFile } from '@/io/projectActions';
import { triggerScreenshot, triggerRecord } from '@/utils/captureBus';
import { OutputControls } from './OutputControls';

/** A3 : charge la liste des fichiers recents depuis le pont IPC. */
function useRecentFiles() {
  const [paths, setPaths] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  const reload = () => {
    window.oneClickToMap?.getRecentFiles().then((r) => setPaths(r.paths)).catch(() => undefined);
  };

  useEffect(() => {
    reload();
  }, []);

  return { paths, open, setOpen, reload };
}

export function Toolbar() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resetSurface = useProjectStore((s) => s.resetSurface);
  const addLayer = useProjectStore((s) => s.addLayer);
  const selectedSurfaceId = useProjectStore((s) => s.selectedSurfaceId);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const canUndo = useProjectStore((s) => s.past.length > 0);
  const canRedo = useProjectStore((s) => s.future.length > 0);
  const [recording, setRecording] = useState(false);
  const recent = useRecentFiles();
  const blackout = useLiveStore((s) => s.blackout);
  const freeze = useLiveStore((s) => s.freeze);
  const toggleBlackout = useLiveStore((s) => s.toggleBlackout);
  const toggleFreeze = useLiveStore((s) => s.toggleFreeze);

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedSurfaceId) return;
    const reader = new FileReader();
    reader.onload = () =>
      addLayer(selectedSurfaceId, { kind: 'image', dataUrl: reader.result as string }, file.name);
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleOpenRecent = async (filePath: string) => {
    recent.setOpen(false);
    // Ouvre le fichier via le pont IPC dedie (sans exposer readFile generique).
    // On reutilise openProjectFromFile pour l'instant : le chemin sert d'indication
    // visuelle seulement (voir handleRecentDisplay).
    try {
      const { openProjectFromFile } = await import('@/io/projectActions');
      await openProjectFromFile();
      // Le chemin sera enregistre via saveProject ; pour l'ouverture,
      // on le signale au process principal pour qu'il pre-remplisse le dialogue.
      void window.oneClickToMap?.addRecentFile(filePath);
      recent.reload();
    } catch {
      // Fichier invalide ou supprime
    }
  };

  const handleScreenshot = () => {
    triggerScreenshot();
  };

  const handleRecord = () => {
    if (recording) {
      triggerRecord('stop');
      setRecording(false);
    } else {
      triggerRecord('start');
      setRecording(true);
    }
  };

  return (
    <header className="toolbar">
      <div className="toolbar-brand">
        <span className="toolbar-logo" aria-hidden="true">
          ◳
        </span>
        <span>OneClickToMap</span>
        <span className="toolbar-badge">Phase 10</span>
      </div>

      <div className="toolbar-actions">
        <button type="button" onClick={undo} disabled={!canUndo} title="Annuler (Ctrl+Z)">
          ↶
        </button>
        <button type="button" onClick={redo} disabled={!canRedo} title="Rétablir (Ctrl+Maj+Z)">
          ↷
        </button>
        <span className="toolbar-divider" />

        {/* A3 : Fichiers recents */}
        <div className="recent-menu">
          <button
            type="button"
            onClick={() => void openProjectFromFile()}
            title="Ouvrir un projet (Ctrl+O)"
          >
            Ouvrir…
          </button>
          {recent.paths.length > 0 && (
            <button
              type="button"
              className="recent-toggle"
              title="Fichiers recents"
              onClick={() => recent.setOpen((o) => !o)}
              aria-expanded={recent.open}
              aria-label="Fichiers recents"
            >
              ▾
            </button>
          )}
          {recent.open && recent.paths.length > 0 && (
            <ul className="recent-dropdown" role="menu">
              {recent.paths.map((p) => (
                <li key={p} role="menuitem">
                  <button type="button" onClick={() => void handleOpenRecent(p)} title={p}>
                    {p.split(/[\\/]/).pop()}
                  </button>
                </li>
              ))}
              <li role="separator" />
              <li role="menuitem">
                <button
                  type="button"
                  onClick={() => {
                    window.oneClickToMap?.clearRecentFiles().catch(() => undefined);
                    recent.reload();
                    recent.setOpen(false);
                  }}
                >
                  Effacer l&apos;historique
                </button>
              </li>
            </ul>
          )}
        </div>

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
        <span className="toolbar-divider" />

        {/* A6 : Screenshot */}
        <button
          type="button"
          onClick={handleScreenshot}
          title="Capturer l'écran (F12)"
          aria-label="Screenshot"
        >
          📷
        </button>

        {/* A5 : Capture vidéo */}
        <button
          type="button"
          onClick={handleRecord}
          className={recording ? 'toolbar-btn-active' : ''}
          title={recording ? 'Arrêter l\'enregistrement' : 'Enregistrer une vidéo'}
          aria-label={recording ? 'Arrêter' : 'Enregistrer'}
          aria-pressed={recording}
        >
          {recording ? '⏹' : '⏺'}
        </button>
        <span className="toolbar-divider" />

        {/* H1 : Blackout global (B) */}
        <button
          type="button"
          onClick={toggleBlackout}
          className={blackout ? 'toolbar-btn-active toolbar-btn-danger' : ''}
          title={blackout ? 'Désactiver le blackout (B)' : 'Blackout global (B)'}
          aria-label={blackout ? 'Désactiver blackout' : 'Blackout'}
          aria-pressed={blackout}
        >
          ⬛
        </button>

        {/* H2 : Freeze vidéo (F2) */}
        <button
          type="button"
          onClick={toggleFreeze}
          className={freeze ? 'toolbar-btn-active' : ''}
          title={freeze ? 'Désactiver le freeze (F2)' : 'Freeze vidéo (F2)'}
          aria-label={freeze ? 'Désactiver freeze' : 'Freeze'}
          aria-pressed={freeze}
        >
          ❄
        </button>
      </div>

      <OutputControls />

      <div className="toolbar-hint">
        <span>Glissez les points · Ctrl+Z / Ctrl+Y · Glissez des fichiers sur le canvas</span>
      </div>
    </header>
  );
}
