import { describe, it, expect, beforeEach } from 'vitest';
import { useOscStore } from '../src/stores/oscStore';

beforeEach(() => {
  useOscStore.setState({ port: 9000, enabled: false, bindings: [] });
});

describe('oscStore', () => {
  it('setPort et setEnabled fonctionnent', () => {
    useOscStore.getState().setPort(8000);
    useOscStore.getState().setEnabled(true);
    const s = useOscStore.getState();
    expect(s.port).toBe(8000);
    expect(s.enabled).toBe(true);
  });

  it('addBinding / removeBinding gèrent les bindings', () => {
    useOscStore.getState().addBinding({
      path: '/ocm/opacity',
      targetType: 'surfaceOpacity',
      min: 0,
      max: 1,
    });
    expect(useOscStore.getState().bindings).toHaveLength(1);
    const id = useOscStore.getState().bindings[0].id;
    useOscStore.getState().removeBinding(id);
    expect(useOscStore.getState().bindings).toHaveLength(0);
  });

  it('updateBinding met à jour un binding', () => {
    useOscStore.getState().addBinding({
      path: '/ocm/opacity', targetType: 'surfaceOpacity', min: 0, max: 1,
    });
    const id = useOscStore.getState().bindings[0].id;
    useOscStore.getState().updateBinding(id, { path: '/ocm/level', min: -1 });
    const b = useOscStore.getState().bindings[0];
    expect(b.path).toBe('/ocm/level');
    expect(b.min).toBe(-1);
    expect(b.max).toBe(1); // inchangé
  });
});
