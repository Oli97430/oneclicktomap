/**
 * A8 — Panneau de personnalisation des raccourcis clavier.
 */
import { useState } from 'react';
import {
  useShortcutsStore,
  shortcutLabel,
  DEFAULT_SHORTCUTS,
  type ShortcutAction,
  type Shortcut,
} from '@/stores/shortcutsStore';

const ACTION_LABELS: Record<ShortcutAction, string> = {
  undo: 'Annuler',
  redo: 'Retablir',
  addSurface: 'Ajouter surface',
  deleteSurface: 'Supprimer surface',
  duplicateSurface: 'Dupliquer surface',
  screenshot: 'Screenshot',
  startRecord: 'Demarrer enregistrement',
  stopRecord: 'Arreter enregistrement',
  playPause: 'Lecture / Pause',
  nextCue: 'Cue suivant',
  prevCue: 'Cue precedent',
  tapTempo: 'Tap tempo',
  togglePerformance: 'Mode performance',
  toggleMask: 'Basculer masque',
  addMaskPoint: 'Ajouter point masque',
  saveProject: 'Enregistrer projet',
  openProject: 'Ouvrir projet',
  blackout: 'Blackout global',
  freeze: 'Freeze video',
  toggleSurfaceLock: 'Verrouiller surface',
};

export function ShortcutsPanel() {
  const shortcuts = useShortcutsStore((s) => s.shortcuts);
  const setShortcut = useShortcutsStore((s) => s.setShortcut);
  const resetShortcuts = useShortcutsStore((s) => s.resetShortcuts);

  const [editing, setEditing] = useState<ShortcutAction | null>(null);
  const [pending, setPending] = useState<Shortcut | null>(null);

  const startEdit = (action: ShortcutAction) => {
    setEditing(action);
    setPending(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Ignore les modificateurs seuls
    if (['Control', 'Meta', 'Alt', 'Shift'].includes(e.key)) return;
    const shortcut: Shortcut = {
      key: e.key,
      ctrl: e.ctrlKey || e.metaKey,
      shift: e.shiftKey,
      alt: e.altKey,
    };
    setPending(shortcut);
  };

  const confirmEdit = (action: ShortcutAction) => {
    if (pending) {
      setShortcut(action, pending);
    }
    setEditing(null);
    setPending(null);
  };

  const cancelEdit = () => {
    setEditing(null);
    setPending(null);
  };

  return (
    <section className="panel shortcuts-panel">
      <div className="panel-head">
        <h2 className="panel-title">Raccourcis clavier</h2>
        <button
          type="button"
          className="panel-action-sm"
          onClick={resetShortcuts}
          title="Reinitialiser tous les raccourcis"
        >
          Reinitialiser
        </button>
      </div>

      <table className="shortcuts-table" aria-label="Raccourcis clavier">
        <thead>
          <tr>
            <th>Action</th>
            <th>Raccourci</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {(Object.keys(ACTION_LABELS) as ShortcutAction[]).map((action) => {
            const isEditing = editing === action;
            const current = shortcuts[action];
            return (
              <tr key={action} className={isEditing ? 'shortcut-row-editing' : 'shortcut-row'}>
                <td className="shortcut-action">{ACTION_LABELS[action]}</td>
                <td>
                  {isEditing ? (
                    <kbd
                      className="shortcut-capture"
                      tabIndex={0}
                      onKeyDown={handleKeyDown}
                      aria-label="Appuyez sur la nouvelle combinaison de touches"
                      autoFocus
                    >
                      {pending ? shortcutLabel(pending) : 'Appuyez sur une touche…'}
                    </kbd>
                  ) : (
                    <kbd className="shortcut-kbd">{shortcutLabel(current)}</kbd>
                  )}
                </td>
                <td className="shortcut-btns">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => confirmEdit(action)}
                        disabled={!pending}
                        aria-label="Confirmer"
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={cancelEdit}
                        aria-label="Annuler"
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => startEdit(action)}
                        aria-label={`Modifier ${ACTION_LABELS[action]}`}
                      >
                        ✎
                      </button>
                      {shortcutLabel(current) !== shortcutLabel(DEFAULT_SHORTCUTS[action]) && (
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => setShortcut(action, DEFAULT_SHORTCUTS[action])}
                          title="Reinitialiser au defaut"
                          aria-label="Reinitialiser"
                        >
                          ↺
                        </button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
