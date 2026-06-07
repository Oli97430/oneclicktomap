import { useEffect, useState } from 'react';
import { useOutputStore } from '@/stores/outputStore';
import type { DisplayInfo } from '../../../shared/contract';

function displayLabel(display: DisplayInfo, index: number): string {
  const name = display.label && display.label.trim() ? display.label : `Écran ${index + 1}`;
  const size = `${display.size.width}×${display.size.height}`;
  return `${name} · ${size}${display.primary ? ' (principal)' : ''}`;
}

const OUTPUT_COUNT = 4;

/** Sélecteur d'écran + index de sortie, ouverture/fermeture de sorties (multi-projecteurs). */
export function OutputControls() {
  const displays = useOutputStore((s) => s.displays);
  const targetDisplayId = useOutputStore((s) => s.targetDisplayId);
  const setTargetDisplay = useOutputStore((s) => s.setTargetDisplay);
  const status = useOutputStore((s) => s.status);
  const refreshDisplays = useOutputStore((s) => s.refreshDisplays);
  const setDisplays = useOutputStore((s) => s.setDisplays);
  const setStatus = useOutputStore((s) => s.setStatus);
  const [outputIndex, setOutputIndex] = useState(0);

  useEffect(() => {
    void refreshDisplays();
    void window.oneClickToMap?.getOutputStatus().then(setStatus);
    const off = window.oneClickToMap?.onDisplaysChanged((next) => setDisplays(next));
    return () => off?.();
  }, [refreshDisplays, setDisplays, setStatus]);

  const isOpen = status.outputs.length > 0;

  const open = async () => {
    if (!window.oneClickToMap) return;
    setStatus(await window.oneClickToMap.openOutput(targetDisplayId, outputIndex));
  };
  const closeAll = async () => {
    if (!window.oneClickToMap) return;
    setStatus(await window.oneClickToMap.closeOutput(null));
  };
  const closeOne = async (displayId: number) => {
    if (!window.oneClickToMap) return;
    setStatus(await window.oneClickToMap.closeOutput(displayId));
  };

  const labelFor = (displayId: number) => {
    const index = displays.findIndex((d) => d.id === displayId);
    return index >= 0 ? displayLabel(displays[index], index) : `Écran ${displayId}`;
  };

  return (
    <div className="output-controls">
      <select
        className="output-select"
        value={targetDisplayId ?? ''}
        onChange={(event) =>
          setTargetDisplay(event.target.value === '' ? null : Number(event.target.value))
        }
        aria-label="Écran de sortie"
      >
        <option value="">Écran auto</option>
        {displays.map((display, index) => (
          <option key={display.id} value={display.id}>
            {displayLabel(display, index)}
          </option>
        ))}
      </select>
      <select
        className="output-index"
        value={outputIndex}
        onChange={(event) => setOutputIndex(Number(event.target.value))}
        aria-label="Index de sortie"
        title="Index de sortie : ne projette que les surfaces affectées à cet index"
      >
        {Array.from({ length: OUTPUT_COUNT }, (_, i) => (
          <option key={i} value={i}>
            Sortie {i + 1}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="output-refresh"
        onClick={() => void refreshDisplays()}
        title="Rechercher les écrans (après connexion sans fil Miracast / AirPlay)"
        aria-label="Rechercher les écrans"
      >
        ⟳
      </button>
      <button type="button" onClick={() => void open()}>
        Ouvrir la sortie
      </button>
      <button
        type="button"
        className={isOpen ? 'is-active' : ''}
        disabled={!isOpen}
        onClick={() => void closeAll()}
      >
        Fermer la sortie
      </button>
      {isOpen && (
        <ul className="output-list">
          {status.outputs.map((o) => (
            <li key={o.displayId} className="output-list-row">
              <span>
                {labelFor(o.displayId)} → Sortie {o.outputIndex + 1}
              </span>
              <button
                type="button"
                onClick={() => void closeOne(o.displayId)}
                aria-label="Fermer cette sortie"
                title="Fermer cette sortie"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
