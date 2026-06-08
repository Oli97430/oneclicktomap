import { describe, it, expect, beforeEach } from 'vitest';
import { useMidiMappingStore } from '../src/stores/midiMappingStore';

beforeEach(() => {
  useMidiMappingStore.setState({ mappings: [], learningId: null });
});

describe('midiMappingStore', () => {
  it('addMapping ajoute un mapping avec id unique', () => {
    useMidiMappingStore.getState().addMapping({
      channel: 0, cc: 7, target: { type: 'layerOpacity' }, label: 'Volume',
    });
    useMidiMappingStore.getState().addMapping({
      channel: -1, cc: 11, target: { type: 'surfaceOpacity' }, label: 'Expression',
    });
    const { mappings } = useMidiMappingStore.getState();
    expect(mappings).toHaveLength(2);
    expect(mappings[0].id).not.toBe(mappings[1].id);
    expect(mappings[0].cc).toBe(7);
    expect(mappings[1].channel).toBe(-1);
  });

  it('removeMapping supprime par id', () => {
    useMidiMappingStore.getState().addMapping({
      channel: 0, cc: 7, target: { type: 'layerOpacity' }, label: '',
    });
    const id = useMidiMappingStore.getState().mappings[0].id;
    useMidiMappingStore.getState().removeMapping(id);
    expect(useMidiMappingStore.getState().mappings).toHaveLength(0);
  });

  it('updateMapping met à jour les champs', () => {
    useMidiMappingStore.getState().addMapping({
      channel: 0, cc: 7, target: { type: 'layerOpacity' }, label: '',
    });
    const id = useMidiMappingStore.getState().mappings[0].id;
    useMidiMappingStore.getState().updateMapping(id, { cc: 74, label: 'Filtre' });
    const m = useMidiMappingStore.getState().mappings[0];
    expect(m.cc).toBe(74);
    expect(m.label).toBe('Filtre');
  });

  it('startLearn / stopLearn gèrent le mode learn', () => {
    useMidiMappingStore.getState().addMapping({
      channel: 0, cc: 7, target: { type: 'layerOpacity' }, label: '',
    });
    const id = useMidiMappingStore.getState().mappings[0].id;
    useMidiMappingStore.getState().startLearn(id);
    expect(useMidiMappingStore.getState().learningId).toBe(id);
    useMidiMappingStore.getState().stopLearn();
    expect(useMidiMappingStore.getState().learningId).toBeNull();
  });
});
