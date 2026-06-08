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

function fmtNum(value: number, step: number): string {
  if (step >= 1) return Math.round(value).toString();
  if (step >= 0.1) return value.toFixed(1);
  return value.toFixed(2);
}

interface ParticleControlsProps {
  surfaceId: string;
  layer: Layer;
}

type NumericKey = 'count' | 'speed' | 'size' | 'gravity';

const SLIDERS: { label: string; key: NumericKey; min: number; max: number; step: number }[] = [
  { label: 'Nombre',  key: 'count',   min: 10,  max: 2000, step: 10  },
  { label: 'Vitesse', key: 'speed',   min: 0,   max: 2,    step: 0.05 },
  { label: 'Taille',  key: 'size',    min: 1,   max: 30,   step: 1   },
  { label: 'Gravité', key: 'gravity', min: 0,   max: 3,    step: 0.05 },
];

export function ParticleControls({ surfaceId, layer }: ParticleControlsProps) {
  const beginDrag = useProjectStore((s) => s.beginDrag);
  const endDrag = useProjectStore((s) => s.endDrag);
  const setParticles = useProjectStore((s) => s.setLayerParticlesTransient);
  const params = layer.source.particles ?? DEFAULT_PARTICLE_PARAMS;

  const setParam = <K extends NumericKey>(key: K, value: number) =>
    setParticles(surfaceId, layer.id, { ...params, [key]: value });

  return (
    <div className="particle-controls">
      {SLIDERS.map(({ label, key, min, max, step }) => (
        <div key={key} className="param-row">
          <label className="param-label" htmlFor={`pc-${layer.id}-${key}`}>
            {label}
          </label>
          <input
            id={`pc-${layer.id}-${key}`}
            type="range"
            min={min}
            max={max}
            step={step}
            value={params[key]}
            onPointerDown={() => beginDrag()}
            onChange={(e) => setParam(key, Number(e.target.value))}
            onPointerUp={() => endDrag()}
            onKeyDown={() => beginDrag()}
            onKeyUp={() => endDrag()}
            onBlur={() => endDrag()}
          />
          <span className="param-value">{fmtNum(params[key], step)}</span>
        </div>
      ))}

      {/* Couleur */}
      <div className="param-row">
        <label className="param-label" htmlFor={`pc-${layer.id}-color`}>
          Couleur
        </label>
        <input
          id={`pc-${layer.id}-color`}
          type="color"
          value={toHex(params.color)}
          onChange={(e) => {
            beginDrag();
            setParticles(surfaceId, layer.id, { ...params, color: fromHex(e.target.value) });
            endDrag();
          }}
        />
        <span className="param-value" style={{ minWidth: 0 }}>{toHex(params.color)}</span>
      </div>

      {/* Réinitialisation */}
      <button
        type="button"
        className="panel-action-sm"
        style={{ marginTop: 6, alignSelf: 'flex-start' }}
        onClick={() => {
          beginDrag();
          setParticles(surfaceId, layer.id, { ...DEFAULT_PARTICLE_PARAMS });
          endDrag();
        }}
        title="Réinitialiser aux valeurs par défaut"
      >
        ↺ Défauts
      </button>
    </div>
  );
}
