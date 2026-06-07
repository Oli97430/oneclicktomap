/**
 * A5/A6 — Bus de capture partagé entre StageCanvas et Toolbar.
 * StageCanvas enregistre son canvas ici ; Toolbar déclenche screenshot/record.
 */

type CaptureListener = (canvas: HTMLCanvasElement) => void;

let canvasRef: HTMLCanvasElement | null = null;
const screenshotListeners: CaptureListener[] = [];
const recordListeners: Array<(canvas: HTMLCanvasElement, action: 'start' | 'stop') => void> = [];

export function registerCanvas(canvas: HTMLCanvasElement | null): void {
  canvasRef = canvas;
}

export function getCanvas(): HTMLCanvasElement | null {
  return canvasRef;
}

export function onScreenshotRequest(fn: CaptureListener): () => void {
  screenshotListeners.push(fn);
  return () => {
    const i = screenshotListeners.indexOf(fn);
    if (i >= 0) screenshotListeners.splice(i, 1);
  };
}

export function triggerScreenshot(): void {
  if (canvasRef) screenshotListeners.forEach((fn) => fn(canvasRef!));
}

export type RecordAction = 'start' | 'stop';
type RecordListener = (canvas: HTMLCanvasElement, action: RecordAction) => void;

export function onRecordRequest(fn: RecordListener): () => void {
  recordListeners.push(fn);
  return () => {
    const i = recordListeners.indexOf(fn);
    if (i >= 0) recordListeners.splice(i, 1);
  };
}

export function triggerRecord(action: RecordAction): void {
  if (canvasRef) recordListeners.forEach((fn) => fn(canvasRef!, action));
}
