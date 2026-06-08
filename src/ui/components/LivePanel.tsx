/**
 * H5/H6 — Panneau Live : mappings MIDI CC et entrée OSC UDP.
 */
import { useEffect, useState } from 'react';
import { useMidiMappingStore, type MidiTargetType } from '@/stores/midiMappingStore';
import { useOscStore, type OscTargetType } from '@/stores/oscStore';
import { useProjectStore } from '@/stores/projectStore';

// ─── MIDI CC ──────────────────────────────────────────────────────────────────

function MidiSection() {
  const { mappings, learningId, addMapping, removeMapping, updateMapping, startLearn, stopLearn } =
    useMidiMappingStore();
  const surfaces = useProjectStore((s) => s.project.surfaces);

  return (
    <div className="live-section">
      <div className="live-section-head">
        <h3 className="live-section-title">MIDI CC</h3>
        <button
          type="button"
          className="icon-btn"
          title="Ajouter un mapping MIDI"
          onClick={() =>
            addMapping({ channel: -1, cc: 0, target: { type: 'layerOpacity' }, label: '' })
          }
        >
          ＋
        </button>
      </div>

      {mappings.length === 0 && (
        <p className="panel-hint">Aucun mapping. Cliquez sur ＋ pour en ajouter un.</p>
      )}

      {mappings.map((m) => {
        const isLearning = learningId === m.id;
        return (
          <div key={m.id} className="midi-row">
            {/* Learn */}
            <button
              type="button"
              className={`midi-learn${isLearning ? ' is-learning' : ''}`}
              title={isLearning ? 'En attente…' : 'Apprendre CC'}
              onClick={() => (isLearning ? stopLearn() : startLearn(m.id))}
            >
              {isLearning ? '⏳' : '◎'}
            </button>

            {/* Channel */}
            <select
              className="midi-select"
              value={m.channel}
              onChange={(e) => updateMapping(m.id, { channel: Number(e.target.value) })}
              title="Canal MIDI (-1 = tous)"
            >
              <option value={-1}>Any</option>
              {Array.from({ length: 16 }, (_, i) => (
                <option key={i} value={i}>
                  Ch {i + 1}
                </option>
              ))}
            </select>

            {/* CC number */}
            <input
              type="number"
              className="midi-cc"
              min={0}
              max={127}
              value={m.cc}
              onChange={(e) =>
                updateMapping(m.id, {
                  cc: Math.max(0, Math.min(127, Number(e.target.value))),
                })
              }
              title="Numéro de contrôleur CC"
              aria-label="CC"
            />

            {/* Target type */}
            <select
              className="midi-select"
              value={m.target.type}
              onChange={(e) =>
                updateMapping(m.id, { target: { ...m.target, type: e.target.value as MidiTargetType } })
              }
            >
              <option value="surfaceOpacity">Opacité surface</option>
              <option value="layerOpacity">Opacité calque</option>
              <option value="shaderParam">Param shader</option>
            </select>

            {/* Surface selector */}
            <select
              className="midi-select"
              value={m.target.surfaceId ?? ''}
              onChange={(e) =>
                updateMapping(m.id, {
                  target: { ...m.target, surfaceId: e.target.value || undefined },
                })
              }
              title="Surface cible"
            >
              <option value="">— surface —</option>
              {surfaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            {/* Layer selector (si pertinent) */}
            {(m.target.type === 'layerOpacity' || m.target.type === 'shaderParam') && (
              <select
                className="midi-select"
                value={m.target.layerId ?? ''}
                onChange={(e) =>
                  updateMapping(m.id, {
                    target: { ...m.target, layerId: e.target.value || undefined },
                  })
                }
                title="Calque cible"
              >
                <option value="">— calque —</option>
                {surfaces
                  .find((s) => s.id === m.target.surfaceId)
                  ?.layers.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
              </select>
            )}

            {/* Param name (shader param) */}
            {m.target.type === 'shaderParam' && (
              <input
                type="text"
                className="midi-param"
                placeholder="uP_speed"
                value={m.target.paramName ?? ''}
                onChange={(e) =>
                  updateMapping(m.id, {
                    target: { ...m.target, paramName: e.target.value || undefined },
                  })
                }
                title="Nom de l'uniform (ex. uP_speed)"
                aria-label="Paramètre shader"
              />
            )}

            <button
              type="button"
              className="icon-btn"
              onClick={() => removeMapping(m.id)}
              title="Supprimer ce mapping"
              aria-label="Supprimer"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── OSC Input ────────────────────────────────────────────────────────────────

function OscSection() {
  const { port, enabled, bindings, setPort, setEnabled, addBinding, removeBinding, updateBinding } =
    useOscStore();
  const surfaces = useProjectStore((s) => s.project.surfaces);
  const [portInput, setPortInput] = useState(String(port));

  // Démarre / arrête le serveur UDP côté Electron à chaque changement.
  useEffect(() => {
    window.oneClickToMap?.oscListen(port, enabled);
    return () => {
      if (enabled) window.oneClickToMap?.oscListen(port, false);
    };
  }, [port, enabled]);

  // Réception des messages OSC et dispatch vers projectStore.
  useEffect(() => {
    if (!enabled) return;
    const off = window.oneClickToMap?.onOscMessage((msg) => {
      const { bindings: current } = useOscStore.getState();
      const proj = useProjectStore.getState();
      for (const b of current) {
        if (b.path !== msg.path) continue;
        const raw = msg.args[0] ?? 0;
        const t = b.max - b.min;
        const value = t === 0 ? raw : Math.max(0, Math.min(1, (raw - b.min) / t));
        if (b.targetType === 'surfaceOpacity' && b.surfaceId) {
          proj.setSurfaceOpacityTransient(b.surfaceId, value);
        } else if (b.targetType === 'layerOpacity' && b.surfaceId && b.layerId) {
          proj.setLayerOpacityTransient(b.surfaceId, b.layerId, value);
        } else if (b.targetType === 'shaderParam' && b.surfaceId && b.layerId && b.paramName) {
          const cur =
            proj.project.surfaces
              .find((s) => s.id === b.surfaceId)
              ?.layers.find((l) => l.id === b.layerId)?.source.shaderParams ?? {};
          proj.setShaderParams(b.surfaceId, b.layerId, { ...cur, [b.paramName]: value });
        }
      }
    });
    return () => off?.();
  }, [enabled]);

  const applyPort = () => {
    const n = parseInt(portInput, 10);
    if (!Number.isNaN(n) && n > 0 && n < 65536) setPort(n);
    else setPortInput(String(port));
  };

  return (
    <div className="live-section">
      <div className="live-section-head">
        <h3 className="live-section-title">OSC (UDP)</h3>
        <div className="osc-port-row">
          <input
            type="text"
            className="osc-port-input"
            value={portInput}
            onChange={(e) => setPortInput(e.target.value)}
            onBlur={applyPort}
            onKeyDown={(e) => e.key === 'Enter' && applyPort()}
            aria-label="Port OSC"
            title="Port UDP d'écoute OSC"
            disabled={enabled}
          />
          <label className="osc-toggle">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              aria-label="Activer le serveur OSC"
            />
            {enabled ? 'ON' : 'OFF'}
          </label>
        </div>
        <button
          type="button"
          className="icon-btn"
          title="Ajouter un binding OSC"
          onClick={() =>
            addBinding({
              path: '/ocm/param',
              targetType: 'layerOpacity',
              min: 0,
              max: 1,
            })
          }
        >
          ＋
        </button>
      </div>

      {bindings.length === 0 && (
        <p className="panel-hint">
          Aucun binding. Envoyez des messages OSC sur le port {port}.
        </p>
      )}

      {bindings.map((b) => (
        <div key={b.id} className="osc-row">
          <input
            type="text"
            className="osc-path"
            placeholder="/ocm/…"
            value={b.path}
            onChange={(e) => updateBinding(b.id, { path: e.target.value })}
            aria-label="Adresse OSC"
          />
          <select
            className="midi-select"
            value={b.targetType}
            onChange={(e) =>
              updateBinding(b.id, { targetType: e.target.value as OscTargetType })
            }
          >
            <option value="surfaceOpacity">Opacité surface</option>
            <option value="layerOpacity">Opacité calque</option>
            <option value="shaderParam">Param shader</option>
          </select>
          <select
            className="midi-select"
            value={b.surfaceId ?? ''}
            onChange={(e) =>
              updateBinding(b.id, { surfaceId: e.target.value || undefined })
            }
          >
            <option value="">— surface —</option>
            {surfaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {(b.targetType === 'layerOpacity' || b.targetType === 'shaderParam') && (
            <select
              className="midi-select"
              value={b.layerId ?? ''}
              onChange={(e) => updateBinding(b.id, { layerId: e.target.value || undefined })}
            >
              <option value="">— calque —</option>
              {surfaces
                .find((s) => s.id === b.surfaceId)
                ?.layers.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
            </select>
          )}
          {b.targetType === 'shaderParam' && (
            <input
              type="text"
              className="midi-param"
              placeholder="uP_speed"
              value={b.paramName ?? ''}
              onChange={(e) => updateBinding(b.id, { paramName: e.target.value || undefined })}
              aria-label="Paramètre shader"
            />
          )}
          <button
            type="button"
            className="icon-btn"
            onClick={() => removeBinding(b.id)}
            title="Supprimer"
            aria-label="Supprimer"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Panel principal ──────────────────────────────────────────────────────────

export function LivePanel() {
  return (
    <section className="panel">
      <h2 className="panel-title">Live</h2>
      <MidiSection />
      <OscSection />
    </section>
  );
}
