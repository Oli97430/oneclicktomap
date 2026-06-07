import { DEFAULT_PARTICLE_PARAMS, useProjectStore } from '@/stores/projectStore';
import type { Layer } from '@/types';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const toHex = (color: [number, number, number]): string =>
  `#${color
    .map((v) =>
      Math.round(clamp01(v) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;

const fromHex = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

interface ParticleControlsProps {
  surfaceId: string;
  layer: Layer;
}

type NumericKey = 'count' | 'speed' | 'size' | 'gravity';

export function ParticleControls({ surfaceId, layer }: ParticleControlsProps) {
  const beginDrag = useProjectStore((s) => s.beginDrag);
  const endDrag = useProjectStore((s) => s.endDrag);
  const setParticles = useProjectStore((s) => s.setLayerParticlesTransient);
  const params = layer.source.particles ?? DEFAULT_PARTICLE_PARAMS;

  const slider = (label: string, key: NumericKey, min: number, max: number, step: number) => (
    <label className="param-row">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={params[key]}
        onPointerDown={() => beginDrag()}
        onChange={(e) =>
          setParticles(surfaceId, layer.id, { ...params, [key]: Number(e.target.value) })
        }
        onPointerUp={() => endDrag()}
        onKeyDown={() => beginDrag()}
        onKeyUp={() => endDrag()}
        onBlur={() => endDrag()}
      />
    </label>
  );

  return (
    <div className="grid-size">
      {slider('Nombre', 'count', 10, 2000, 10)}
      {slider('Vitesse', 'speed', 0, 2, 0.05)}
      {slider('Taille', 'size', 1, 30, 1)}
      {slider('Gravité', 'gravity', 0, 3, 0.05)}
      <label className="param-row">
        <span>Couleur</span>
        <input
          type="color"
          value={toHex(params.color)}
          onChange={(e) => {
            beginDrag();
            setParticles(surfaceId, layer.id, { ...params, color: fromHex(e.target.value) });
            endDrag();
          }}
        />
      </label>
      <p className="panel-hint">{Math.round(params.count)} particules.</p>
    </div>
  );
}
