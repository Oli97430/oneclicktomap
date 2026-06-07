import { useEffect, useState } from 'react';
import { DEFAULT_PARTICLE_PARAMS, useProjectStore } from '@/stores/projectStore';
import { SHADER_PRESETS, type ShaderPreset } from '@/content/shaderPresets';
import { validateFragmentShader } from '@/engine/GenerativeTexture';
import { ParticleControls } from './ParticleControls';

export function GeneratorPanel() {
  const surfaces = useProjectStore((s) => s.project.surfaces);
  const selectedSurfaceId = useProjectStore((s) => s.selectedSurfaceId);
  const selectedLayerId = useProjectStore((s) => s.selectedLayerId);
  const addLayer = useProjectStore((s) => s.addLayer);
  const setLayerShaderCode = useProjectStore((s) => s.setLayerShaderCode);

  const surface = surfaces.find((s) => s.id === selectedSurfaceId);
  const selectedLayer = surface?.layers.find((l) => l.id === selectedLayerId);
  const isGenerative = selectedLayer?.source.kind === 'generative';
  const isParticles = selectedLayer?.source.kind === 'particles';
  const selectedCode = isGenerative ? (selectedLayer?.source.shaderCode ?? '') : '';

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Recharge l'éditeur quand on sélectionne un autre calque génératif (ou après undo).
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
    addLayer(selectedSurfaceId, { kind: 'generative', shaderCode: preset.code }, preset.name);
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

  return (
    <section className="panel">
      <h2 className="panel-title">Générateur</h2>
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
        </div>
      )}

      {isParticles && surface && selectedLayer && (
        <ParticleControls surfaceId={surface.id} layer={selectedLayer} />
      )}

      {!isGenerative && !isParticles && (
        <p className="panel-hint">
          Cliquez un preset (ou « Particules ») pour ajouter un calque génératif, puis
          sélectionnez-le pour l'éditer.
        </p>
      )}
    </section>
  );
}
