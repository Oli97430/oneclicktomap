/**
 * H5 — Hook Web MIDI : écoute les messages CC sur toutes les entrées
 * et dispatche vers les stores (opacité surface/calque, shader params).
 */
import { useEffect } from 'react';
import { useMidiMappingStore } from '@/stores/midiMappingStore';
import { useProjectStore } from '@/stores/projectStore';

/** Normalize MIDI value 0-127 to [0, 1]. */
const norm = (v: number): number => Math.max(0, Math.min(1, v / 127));

export function useMidiMapping(): void {
  useEffect(() => {
    if (!navigator.requestMIDIAccess) return;

    let access: MIDIAccess | null = null;
    const handlers = new Map<MIDIInput, (e: MIDIMessageEvent) => void>();

    const handleMessage = (e: MIDIMessageEvent) => {
      if (!e.data || e.data.length < 3) return;
      const status = e.data[0];
      // CC message : 0xBn (n = canal 0-15)
      if ((status & 0xf0) !== 0xb0) return;
      const channel = status & 0x0f;
      const cc = e.data[1];
      const rawValue = e.data[2];

      const { mappings, learningId, stopLearn, updateMapping } = useMidiMappingStore.getState();

      // Mode learn : affecte le CC reçu au mapping en cours d'édition.
      if (learningId !== null) {
        updateMapping(learningId, { channel, cc });
        stopLearn();
        return;
      }

      const value = norm(rawValue);
      const proj = useProjectStore.getState();

      for (const m of mappings) {
        if (m.channel !== -1 && m.channel !== channel) continue;
        if (m.cc !== cc) continue;

        const { type, surfaceId, layerId, paramName } = m.target;

        if (type === 'surfaceOpacity' && surfaceId) {
          proj.setSurfaceOpacityTransient(surfaceId, value);
        } else if (type === 'layerOpacity' && surfaceId && layerId) {
          proj.setLayerOpacityTransient(surfaceId, layerId, value);
        } else if (type === 'shaderParam' && surfaceId && layerId && paramName) {
          const currentParams =
            proj.project.surfaces
              .find((s) => s.id === surfaceId)
              ?.layers.find((l) => l.id === layerId)?.source.shaderParams ?? {};
          proj.setShaderParams(surfaceId, layerId, { ...currentParams, [paramName]: value });
        }
      }
    };

    const attachInput = (input: MIDIInput) => {
      const handler = (e: Event) => handleMessage(e as MIDIMessageEvent);
      input.addEventListener('midimessage', handler);
      handlers.set(input, handler as (e: MIDIMessageEvent) => void);
    };

    const detachAll = () => {
      handlers.forEach((handler, input) => {
        input.removeEventListener('midimessage', handler as EventListener);
      });
      handlers.clear();
    };

    navigator.requestMIDIAccess({ sysex: false }).then((midi) => {
      access = midi;
      midi.inputs.forEach(attachInput);
      midi.onstatechange = (e) => {
        const port = e.port;
        if (!port) return;
        if (port.type === 'input') {
          if (port.state === 'connected') {
            attachInput(port as MIDIInput);
          } else {
            const h = handlers.get(port as MIDIInput);
            if (h) {
              port.removeEventListener('midimessage', h as EventListener);
              handlers.delete(port as MIDIInput);
            }
          }
        }
      };
    }).catch(() => { /* MIDI non disponible */ });

    return () => {
      detachAll();
      if (access) access.onstatechange = null;
    };
  }, []);
}
