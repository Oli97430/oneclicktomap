import { useEffect, useRef, useState } from 'react';
import { useDetectionStore } from '@/stores/detectionStore';
import { useProjectStore } from '@/stores/projectStore';
import { CameraCapture, type CameraDevice } from '@/detection/CameraCapture';
import { buildGrayPatterns } from '@/detection/grayCode';
import { toGrayscale } from '@/detection/imageProcessing';
import { depthToHeatmapRGBA, estimateDepth } from '@/detection/depth';
import type { WarpMode } from '@/types';

export function DetectionPanel() {
  const enabled = useDetectionStore((s) => s.enabled);
  const toggle = useDetectionStore((s) => s.toggle);
  const setEnabled = useDetectionStore((s) => s.setEnabled);
  const deviceId = useDetectionStore((s) => s.deviceId);
  const setDeviceId = useDetectionStore((s) => s.setDeviceId);
  const detection = useDetectionStore((s) => s.detection);
  const setDetection = useDetectionStore((s) => s.setDetection);
  const addSurfaceFromDetection = useProjectStore((s) => s.addSurfaceFromDetection);

  const videoRef = useRef<HTMLVideoElement>(null);
  const depthRef = useRef<HTMLCanvasElement>(null);
  const grayRef = useRef<HTMLCanvasElement>(null);
  const captureRef = useRef<CameraCapture | null>(null);
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [hint, setHint] = useState<string | null>(null);

  // Cycle de vie de la caméra (suivant l'état du store).
  useEffect(() => {
    if (!enabled) return;
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    const capture = new CameraCapture(video);
    captureRef.current = capture;
    capture
      .start(deviceId ?? undefined)
      .then(() => {
        if (cancelled) return;
        setHint(null);
        CameraCapture.listCameras()
          .then((list) => {
            if (!cancelled) setDevices(list);
          })
          .catch(() => undefined);
      })
      .catch(() => {
        if (cancelled) return;
        setEnabled(false);
        setHint('Caméra indisponible ou autorisation refusée.');
      });

    return () => {
      cancelled = true;
      capture.stop();
      captureRef.current = null;
    };
  }, [enabled, deviceId, setEnabled]);

  // Aperçu statique des motifs Gray-code (lumière structurée).
  useEffect(() => {
    const canvas = grayRef.current;
    if (!canvas) return;
    const width = 160;
    const patterns = buildGrayPatterns(width);
    const bandHeight = 6;
    canvas.width = width;
    canvas.height = patterns.length * bandHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#05070d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#7fd3ff';
    patterns.forEach((pattern, row) => {
      for (let x = 0; x < width; x += 1) {
        if (pattern.stripes[x]) ctx.fillRect(x, row * bandHeight, 1, bandHeight);
      }
    });
  }, []);

  const detect = () => {
    const capture = captureRef.current;
    if (!capture) return;
    const result = capture.detect();
    if (!result?.quad || !result.controlPoints) {
      setDetection(null);
      setHint('Aucune surface nette détectée — améliorez le contraste / l’éclairage.');
      return;
    }
    setHint(null);
    setDetection({
      quad: result.quad,
      controlPoints: result.controlPoints,
      width: result.width,
      height: result.height,
    });
  };

  const previewDepth = () => {
    const capture = captureRef.current;
    const canvas = depthRef.current;
    if (!capture || !canvas) return;
    const frame = capture.grabFrame();
    if (!frame) return;
    const gray = toGrayscale(frame);
    const depth = estimateDepth(gray, frame.width, frame.height);
    canvas.width = frame.width;
    canvas.height = frame.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(new ImageData(depthToHeatmapRGBA(depth), frame.width, frame.height), 0, 0);
  };

  const createSurface = (mode: WarpMode) => {
    if (!detection) return;
    addSurfaceFromDetection(detection.controlPoints, mode);
  };

  return (
    <section className="panel">
      <h2 className="panel-title">Détection de surface</h2>
      <button
        type="button"
        className={`panel-action${enabled ? ' is-active' : ''}`}
        onClick={toggle}
      >
        {enabled ? 'Caméra active' : 'Activer la caméra'}
      </button>

      {enabled && devices.length > 1 && (
        <select
          className="device-select"
          value={deviceId ?? ''}
          onChange={(event) => setDeviceId(event.target.value || null)}
          aria-label="Choisir la caméra"
        >
          <option value="">Caméra par défaut</option>
          {devices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label}
            </option>
          ))}
        </select>
      )}

      <div className="cam-preview">
        <video ref={videoRef} className="cam-video" muted playsInline aria-label="Aperçu caméra" />
        {detection && (
          <svg
            className="cam-overlay"
            viewBox={`0 0 ${detection.width} ${detection.height}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <polygon points={detection.quad.map((p) => `${p.x},${p.y}`).join(' ')} />
          </svg>
        )}
      </div>

      <div className="detect-actions">
        <button type="button" className="panel-action" disabled={!enabled} onClick={detect}>
          Détecter la surface
        </button>
        <button type="button" className="panel-action" disabled={!enabled} onClick={previewDepth}>
          Aperçu profondeur
        </button>
      </div>

      {detection && (
        <div className="detect-actions">
          <button type="button" className="panel-action" onClick={() => createSurface('quad')}>
            + Surface (quad)
          </button>
          <button type="button" className="panel-action" onClick={() => createSurface('grid')}>
            + Surface (grille)
          </button>
        </div>
      )}

      <canvas ref={depthRef} className="cam-canvas" aria-hidden="true" />

      <div className="gray-block">
        <span className="gray-label">Motifs Gray-code (lumière structurée)</span>
        <canvas ref={grayRef} className="cam-canvas gray-preview" aria-hidden="true" />
      </div>

      {hint && <p className="panel-hint">{hint}</p>}
      <p className="panel-hint">
        Visez la surface, « Détecter » repère son contour (Canny + quadrilatère), puis créez une
        surface alignée. Profondeur = estimation heuristique (substitut de MiDaS).
      </p>
    </section>
  );
}
