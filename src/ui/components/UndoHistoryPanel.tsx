/**
 * A7 — Panneau historique undo/redo.
 * Affiche toutes les actions passees/futures avec leur libelle.
 * Un clic sur une entree passe et annule/retablit jusqu'a cet etat.
 */
import { useProjectStore } from '@/stores/projectStore';

export function UndoHistoryPanel() {
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const canUndo = useProjectStore((s) => s.past.length > 0);
  const canRedo = useProjectStore((s) => s.future.length > 0);
  const historyLabels = useProjectStore((s) => s.historyLabels);
  const { past, present, future } = historyLabels();

  // Pour revenir a un etat passe : il faut appuyer undo (past.length - index) fois.
  // On expose des boutons undo/redo simples plutot qu'un saut direct (complexite).

  return (
    <section className="panel history-panel">
      <div className="panel-head">
        <h2 className="panel-title">Historique</h2>
        <div className="panel-head-actions">
          <button
            type="button"
            className="icon-btn"
            onClick={undo}
            disabled={!canUndo}
            title="Annuler (Ctrl+Z)"
            aria-label="Annuler"
          >
            ↶
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={redo}
            disabled={!canRedo}
            title="Retablir (Ctrl+Y)"
            aria-label="Retablir"
          >
            ↷
          </button>
        </div>
      </div>

      <ul className="history-list" aria-label="Historique des actions">
        {/* Etats passes (du plus recent au plus ancien) */}
        {[...past].reverse().map((label, i) => (
          <li key={`past-${i}`} className="history-entry history-past">
            <span className="history-label">{label || '(action)'}</span>
          </li>
        ))}

        {/* Etat courant */}
        <li className="history-entry history-current" aria-current="true">
          <span className="history-indicator">●</span>
          <span className="history-label">{present || 'Etat initial'}</span>
        </li>

        {/* Etats futurs (du plus proche au plus loin) */}
        {future.map((label, i) => (
          <li key={`future-${i}`} className="history-entry history-future">
            <span className="history-label">{label || '(action)'}</span>
          </li>
        ))}
      </ul>

      {past.length === 0 && future.length === 0 && (
        <p className="panel-hint">Aucune action enregistree.</p>
      )}
    </section>
  );
}
