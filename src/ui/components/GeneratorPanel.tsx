import { useEffect, useState } from 'react';
import { DEFAULT_PARTICLE_PARAMS, useProjectStore } from '@/stores/projectStore';
import { SHADER_PRESETS, type ShaderPreset } from '@/content/shaderPresets';
import { validateFragmentShader } from '@/engine/GenerativeTexture';
import { parseShaderParams, defaultShaderParams } from '@/utils/shaderParams';
import { ParticleControls } from './ParticleControls';

export function GeneratorPanel() {
  const surfaces = useProjectStore((s) => s.project.surfaces);
  const selectedSurfaceId = useProjectStore((s) => s.selectedSurfaceId);
  const selectedLayerId = useProjectStore((s) => s.selectedLayerId);
  const addLayer = useProjectStore((s) => s.addLayer);
  const setLayerShaderCode = useProjectStore((s) => s.setLayerShaderCode);
  const setShaderParams = useProjectStore((s) => s.setShaderParams);

  const surface = surfaces.find((s) => s.id === selectedSurfaceId);
  const selectedLayer = surface?.layers.find((l) => l.id === selectedLayerId);
  const isGenerative = selectedLayer?.source.kind === 'generative';
  const isParticles = selectedLayer?.source.kind === 'particles';
  const selectedCode = isGenerative ? (selectedLayer?.source.shaderCode ?? '') : '';

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  // D2 : parametres exposes du calque courant.
  const storedParams = (isGenerative && selectedLayer?.source.shaderParams) || {};
  // Definitions extraites du code courant (dans l'editeur, pas forcement sauvegarde).
  const paramDefs = isGenerative ? parseShaderParams(code) : [];
  // Valeurs affichees : stored si disponibles, sinon defaut.
  const paramValues: Record<string, number> = {};
  paramDefs.forEach((d) => {
    paramValues[d.uniformName] = storedParams[d.uniformName] ?? d.default;
  });

  // Recharge l'editeur quand on selectionne un autre calque generatif (ou apres undo).
  useEffect(() => {
    setCode(selectedCode);
    setError(null);
  }, [selectedLayerId, selectedCode]);

  const addPreset = (preset: ShaderPreset) => {
    if (!selectedSurfaceId) return;
    const err = validateFragmentShader(preset.code);
    if (err) {
      setError(err);
      return;
    }
    // D2 : initialise les params avec les valeurs par defaut du preset.
    const initialParams = preset.params
      ? defaultShaderParams(preset.params)
      : {};
    addLayer(selectedSurfaceId, { kind: 'generative', shaderCode: preset.code, shaderParams: initialParams }, preset.name);
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
    const updated = { ...storedParams, [uniformName]: value };
    setShaderParams(surface.id, selectedLayer.id, updated);
  };

  return (
    <section className="panel">
      <h2 className="panel-title">Generateur</h2>
      <div className="preset-grid">
        {SHADER_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="preset-btn"
            disabled={!selectedSurfaceId}
            onClick={() => addPreset(preset)}
          >
            {preset.name}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="panel-action"
        style={{ marginTop: 6 }}
        disabled={!selectedSurfaceId}
        onClick={addParticles}
      >
        + Particules
      </button>

      {isGenerative && (
        <div className="shader-editor">
          <textarea
            className="shader-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            spellCheck={false}
            rows={8}
            aria-label="Code du shader"
          />
          <button type="button" className="panel-action" onClick={apply}>
            Appliquer le shader
          </button>
          {error && <pre className="shader-error">{error}</pre>}

          {/* D2 : sliders pour les parametres exposes (uP_*) */}
          {paramDefs.length > 0 && (
            <div className="shader-params">
              <h3 className="params-title">Parametres</h3>
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
                    onChange={(e) => handleParamChange(def.uniformName, Number(e.target.value))}
                    aria-label={def.label}
                  />
                  <span className="param-value">
                    {(paramValues[def.uniformName] ?? def.default).toFixed(2)}
                  </span>
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
          Cliquez un preset (ou « Particules ») pour ajouter un calque génératif, puis
          sélectionnez-le pour l&apos;éditer.
        </p>
      )}
    </section>
  );
}
