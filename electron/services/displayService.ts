import { screen } from 'electron';
import type { DisplayInfo } from '../../shared/contract';

/**
 * Énumère les écrans connectés. Sera utilisé en Phase 1 (point 5) pour la
 * sortie plein écran sur l'écran secondaire (projecteur).
 */
export function listDisplays(): DisplayInfo[] {
  const primaryId = screen.getPrimaryDisplay().id;

  return screen.getAllDisplays().map((display) => ({
    id: display.id,
    label: display.label || `Écran ${display.id}`,
    bounds: display.bounds,
    size: display.size,
    scaleFactor: display.scaleFactor,
    internal: display.internal,
    primary: display.id === primaryId,
  }));
}
