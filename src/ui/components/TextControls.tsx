/**
 * C4 - Controles d'un calque texte.
 * Permet d'editer le contenu, la typo, la couleur et le defilement.
 */
import { useProjectStore } from '@/stores/projectStore';
import type { Layer, TextParams } from '@/types';

const FONT_FAMILIES = [
  'sans-serif',
  'serif',
  'monospace',
  'cursive',
  'Impact',
  'Georgia',
  'Courier New',
];

const ALIGN_OPTIONS: { value: TextParams['align']; label: string }[] = [
  { value: 'left', label: 'Gauche' },
  { value: 'center', label: 'Centre' },
  { value: 'right', label: 'Droite' },
];

interface TextControlsProps {
  surfaceId: string;
  layer: Layer;
}

export function TextControls({ surfaceId, layer }: TextControlsProps) {
  const setTextParamsTransient = useProjectStore((s) => s.setTextParamsTransient);
  const beginDrag = useProjectStore((s) => s.beginDrag);
  const endDrag = useProjectStore((s) => s.endDrag);

  const params = layer.source.textParams;
  if (!params) return null;

  const update = (partial: Partial<TextParams>) => {
    setTextParamsTransient(surfaceId, layer.id, { ...params, ...partial });
  };

  return (
    <div className="text-controls">
      <label className="text-ctrl-label">
        Contenu
        <textarea
          className="text-content-input"
          value={params.content}
          rows={3}
          onChange={(e) => update({ content: e.target.value })}
          aria-label="Texte a afficher"
        />
      </label>

      <div className="text-ctrl-row">
        <label className="text-ctrl-label" style={{ flex: 1 }}>
          Police
          <select
            value={params.fontFamily}
            onChange={(e) => update({ fontFamily: e.target.value })}
            aria-label="Police"
          >
            {FONT_FAMILIES.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </label>

        <label className="text-ctrl-label">
          Taille
          <input
            type="number"
            min={8}
            max={512}
            value={params.fontSize}
            onChange={(e) => update({ fontSize: Number(e.target.value) })}
            style={{ width: 64 }}
            aria-label="Taille de police"
          />
        </label>
      </div>

      <div className="text-ctrl-row">
        <label className="text-ctrl-label">
          Couleur
          <input
            type="color"
            value={params.color}
            onChange={(e) => update({ color: e.target.value })}
            aria-label="Couleur du texte"
          />
        </label>
        <label className="text-ctrl-label">
          Fond
          <input
            type="color"
            value={params.background === 'transparent' ? '#000000' : params.background}
            onChange={(e) => update({ background: e.target.value })}
            aria-label="Couleur de fond"
          />
        </label>
        <label className="text-ctrl-label text-ctrl-check">
          <input
            type="checkbox"
            checked={params.background === 'transparent'}
            onChange={(e) => update({ background: e.target.checked ? 'transparent' : '#000000' })}
            aria-label="Fond transparent"
          />
          Transparent
        </label>
      </div>

      <div className="text-ctrl-row">
        <label className="text-ctrl-label">
          Alignement
          <select
            value={params.align}
            onChange={(e) => update({ align: e.target.value as TextParams['align'] })}
            aria-label="Alignement"
          >
            {ALIGN_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>

        <label className="text-ctrl-label text-ctrl-check">
          <input
            type="checkbox"
            checked={params.bold}
            onChange={(e) => update({ bold: e.target.checked })}
            aria-label="Gras"
          />
          Gras
        </label>
        <label className="text-ctrl-label text-ctrl-check">
          <input
            type="checkbox"
            checked={params.italic}
            onChange={(e) => update({ italic: e.target.checked })}
            aria-label="Italique"
          />
          Italique
        </label>
      </div>

      <label className="text-ctrl-label">
        Defilement ({params.scrollSpeed === 0 ? 'Fixe' : `${params.scrollSpeed.toFixed(1)} px/s`})
        <input
          type="range"
          min={0}
          max={200}
          step={1}
          value={params.scrollSpeed}
          onPointerDown={() => beginDrag()}
          onChange={(e) => update({ scrollSpeed: Number(e.target.value) })}
          onPointerUp={() => endDrag()}
          aria-label="Vitesse de defilement"
        />
      </label>
    </div>
  );
}
