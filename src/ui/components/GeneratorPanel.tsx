import { useEffect, useRef, useState } from 'react';
import { DEFAULT_PARTICLE_PARAMS, useProjectStore } from '@/stores/projectStore';
import {
  SHADER_PRESETS,
  type ShaderPreset,
  type PresetCategory,
} from '@/content/shaderPresets';
import { validateFragmentShader } from '@/engine/GenerativeTexture';
import { parseShaderParams, defaultShaderParams } from '@/utils/shaderParams';
import { ParticleControls } from './ParticleControls';

// ── constantes ──────────────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<PresetCategory, string> = {
  base: 'Effets de base',
  audio: 'Audio-réactif ♪',
  avance: 'Avancé',
};
const CATEGORY_ORDER: PresetCategory[] = ['base', 'audio', 'avance'];

/** Groupe les presets par catégorie dans l'ordre souhaité. */
function groupPresets(presets: ShaderPreset[]): Map<PresetCategory, ShaderPreset[]> {
  const map = new Map<PresetCategory, ShaderPreset[]>(CATEGORY_ORDER.map((c) => [c, []]));
  for (const p of presets) {
    (map.get(p.category) ?? map.get('avance')!).push(p);
  }
  return map;
}

/** Formate une valeur numérique selon le pas (évite le .00 inutile). */
function fmtNum(value: number, step: number): string {
  if (step >= 1) return Math.round(value).toString();
  if (step >= 0.1) return value.toFixed(1);
  return value.toFixed(2);
}

const GROUPED = groupPresets(SHADER_PRESETS);

// ── composant ────────────────────────────────────────────────────────────────
export function GeneratorPanel() {
  const surfaces = useProjectStore((s) => s.project.surfaces);
  const selectedSurfaceId = useProjectStore((s) => s.selectedSurfaceId);
  const selectedLayerId = useProjectStore((s) => s.selectedLayerId);
  const addLayer = useProjectStore((s) => s.addLayer);
  const setLayerShaderCode = useProjectStore((s) => s.setLayerShaderCode);
  const setShaderParams = useProjectStore((s) => s.setShaderParams);
  const beginDrag = useProjectStore((s) => s.beginDrag);
  const endDrag = useProjectStore((s) => s.endDrag);

  const surface = surfaces.find((s) => s.id === selectedSurfaceId);
  const selectedLayer = surface?.layers.find((l) => l.id === selectedLayerId);
  const isGenerative = selectedLayer?.source.kind === 'generative';
  const isParticles = selectedLayer?.source.kind === 'particles';
  const selectedCode = isGenerative ? (selectedLayer?.source.shaderCode ?? '') : '';

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  /** Curseur à restaurer après un `setCode` provoqué par la touche Tab. */
  const pendingCursor = useRef<number | null>(null);

  // D2 : paramètres stockés + définitions parsées depuis le code courant.
  const storedParams = (isGenerative && selectedLayer?.source.shaderParams) || {};
  const paramDefs = isGenerative ? parseShaderParams(code) : [];
  const paramValues: Record<string, number> = {};
  paramDefs.forEach((d) => {
    paramValues[d.uniformName] = storedParams[d.uniformName] ?? d.default;
  });

  // Indicateur : le code de l'éditeur diffère du code appliqué.
  const isDirty = isGenerative && code !== selectedCode;

  // Synchronise l'éditeur lors d'un changement de calque ou d'un undo.
  useEffect(() => {
    setCode(selectedCode);
    setError(null);
  }, [selectedLayerId, selectedCode]);

  // Restaure la position du curseur après une tabulation (React re-render sync).
  useEffect(() => {
    if (pendingCursor.current !== null && textareaRef.current) {
      const pos = pendingCursor.current;
      textareaRef.current.selectionStart = pos;
      textareaRef.current.selectionEnd = pos;
      pendingCursor.current = null;
    }
  }, [code]);

  // ── handlers ──────────────────────────────────────────────────────────────
  const addPreset = (preset: ShaderPreset) => {
    if (!selectedSurfaceId) return;
    const err = validateFragmentShader(preset.code);
    if (err) { setError(err); return; }
    // Source de vérité unique : annotations [min, max, default] dans le GLSL.
    const initialParams = defaultShaderParams(parseShaderParams(preset.code));
    addLayer(
      selectedSurfaceId,
      { kind: 'generative', shaderCode: preset.code, shaderParams: initialParams },
      preset.name,
    );
  };

  const addParticles = () => {
    if (!selectedSurfaceId) return;
    addLayer(
      selectedSurfaceId,
      { kind: 'particles', particles: { ...DEFAULT_PARTICLE_PARAMS } },
      'Particules',
    );
  };

  const apply = () => {
    if (!surface || !selectedLayer) return;
    const err = validateFragmentShader(code);
    setError(err);
    if (!err) setLayerShaderCode(surface.id, selectedLayer.id, code);
  };

  const handleParamChange = (uniformName: string, value: number) => {
    if (!surface || !selectedLayer) return;
    setShaderParams(surface.id, selectedLayer.id, { ...storedParams, [uniformName]: value });
  };

  const resetAllParams = () => {
    if (!surface || !selectedLayer) return;
    setShaderParams(surface.id, selectedLayer.id, defaultShaderParams(paramDefs));
  };

  const handleShaderKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const indent = '  ';
      setCode(code.slice(0, start) + indent + code.slice(end));
      pendingCursor.current = start + indent.length;
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      apply();
    }
  };

  // ── rendu ─────────────────────────────────────────────────────────────────
  return (
    <section className="panel">
      <h2 className="panel-title">Générateur</h2>

      {/* Presets groupés par catégorie */}
      {CATEGORY_ORDER.map((cat) => {
        const presets = GROUPED.get(cat) ?? [];
        if (!presets.length) return null;
        return (
          <div key={cat} className="preset-category-group">
            <p className="preset-category-label">{CATEGORY_LABELS[cat]}</p>
            <div className="preset-grid">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={`preset-btn${preset.category === 'audio' ? ' preset-btn-audio' : ''}`}
                  disabled={!selectedSurfaceId}
                  onClick={() => addPreset(preset)}
                  title={preset.name}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      <button
        type="button"
        className="panel-action"
        style={{ marginTop: 6 }}
        disabled={!selectedSurfaceId}
        onClick={addParticles}
      >
        + Particules
      </button>

      {/* Éditeur de shader */}
      {isGenerative && (
        <div className="shader-editor">
          <textarea
            ref={textareaRef}
            className="shader-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={handleShaderKeyDown}
            spellCheck={false}
            rows={8}
            aria-label="Code du shader"
          />

          <div className="shader-editor-footer">
            <button
              type="button"
              className={`panel-action${isDirty ? ' panel-action-dirty' : ''}`}
              onClick={apply}
              title="Appliquer le shader (Ctrl+Entrée)"
            >
              {isDirty ? '● Appliquer' : 'Appliquer'}
            </button>
            <span className="shader-hint">Tab·indent — Ctrl+↵·appliquer</span>
          </div>

          {error && <pre className="shader-error">{error}</pre>}

          {/* D2 : sliders paramètres exposés */}
          {paramDefs.length > 0 && (
            <div className="shader-params">
              <div className="params-header">
                <h3 className="params-title">Paramètres</h3>
                <button
                  type="button"
                  className="panel-action-sm"
                  onClick={resetAllParams}
                  title="Réinitialiser tous les paramètres aux valeurs par défaut"
                >
                  ↺ Défauts
                </button>
              </div>
              {paramDefs.map((def) => (
                <div key={def.uniformName} className="param-row">
                  <label className="param-label" htmlFor={`param-${def.uniformName}`}>
                    {def.label}
                  </label>
                  <input
                    id={`param-${def.uniformName}`}
                    type="range"
                    min={def.min}
                    max={def.max}
                    step={def.step}
                    value={paramValues[def.uniformName] ?? def.default}
                    onPointerDown={() => beginDrag()}
                    onChange={(e) => handleParamChange(def.uniformName, Number(e.target.value))}
                    onPointerUp={() => endDrag()}
                    onKeyDown={() => beginDrag()}
                    onKeyUp={() => endDrag()}
                    onBlur={() => endDrag()}
                    aria-label={def.label}
                  />
                  <span className="param-value">
                    {fmtNum(paramValues[def.uniformName] ?? def.default, def.step)}
                  </span>
                  <button
                    type="button"
                    className="param-reset-btn"
                    onClick={() => handleParamChange(def.uniformName, def.default)}
                    title={`Réinitialiser à ${fmtNum(def.default, def.step)}`}
                    aria-label={`Réinitialiser ${def.label}`}
                  >
                    ↺
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isParticles && surface && selectedLayer && (
        <ParticleControls surfaceId={surface.id} layer={selectedLayer} />
      )}

      {!isGenerative && !isParticles && (
        <p className="panel-hint">
          Cliquez un preset pour ajouter un calque génératif, puis
          sélectionnez-le pour l&apos;éditer.
        </p>
      )}
    </section>
  );
}
