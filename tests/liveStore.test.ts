import { describe, it, expect, beforeEach } from 'vitest';
import { useLiveStore } from '../src/stores/liveStore';

beforeEach(() => {
  useLiveStore.setState({ blackout: false, freeze: false });
});

describe('liveStore', () => {
  it('toggleBlackout bascule le blackout', () => {
    expect(useLiveStore.getState().blackout).toBe(false);
    useLiveStore.getState().toggleBlackout();
    expect(useLiveStore.getState().blackout).toBe(true);
    useLiveStore.getState().toggleBlackout();
    expect(useLiveStore.getState().blackout).toBe(false);
  });

  it('toggleFreeze bascule le freeze', () => {
    expect(useLiveStore.getState().freeze).toBe(false);
    useLiveStore.getState().toggleFreeze();
    expect(useLiveStore.getState().freeze).toBe(true);
  });

  it('setBlackout / setFreeze affectent directement', () => {
    useLiveStore.getState().setBlackout(true);
    useLiveStore.getState().setFreeze(true);
    const s = useLiveStore.getState();
    expect(s.blackout).toBe(true);
    expect(s.freeze).toBe(true);
    useLiveStore.getState().setBlackout(false);
    expect(useLiveStore.getState().blackout).toBe(false);
    expect(useLiveStore.getState().freeze).toBe(true);
  });
});
