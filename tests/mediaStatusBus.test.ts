import { describe, it, expect, beforeEach } from 'vitest';
import {
  getMediaStatus,
  setMediaStatus,
  clearMediaStatus,
  subscribeMediaStatus,
} from '../src/utils/mediaStatusBus';

beforeEach(() => {
  // Réinitialise les ids utilisés par les tests.
  clearMediaStatus('a');
  clearMediaStatus('b');
});

describe('mediaStatusBus', () => {
  it('retourne "loading" par défaut pour un id inconnu', () => {
    expect(getMediaStatus('inexistant')).toBe('loading');
  });

  it('mémorise et relit un statut', () => {
    setMediaStatus('a', 'ready');
    expect(getMediaStatus('a')).toBe('ready');
    setMediaStatus('a', 'error');
    expect(getMediaStatus('a')).toBe('error');
  });

  it('notifie les abonnés sur changement de statut', () => {
    let calls = 0;
    const unsub = subscribeMediaStatus(() => { calls += 1; });
    setMediaStatus('a', 'ready');
    expect(calls).toBe(1);
    // Même valeur → pas de notification.
    setMediaStatus('a', 'ready');
    expect(calls).toBe(1);
    setMediaStatus('a', 'error');
    expect(calls).toBe(2);
    unsub();
    setMediaStatus('a', 'loading');
    expect(calls).toBe(2); // plus abonné
  });

  it('clearMediaStatus efface le statut et notifie', () => {
    let calls = 0;
    const unsub = subscribeMediaStatus(() => { calls += 1; });
    setMediaStatus('b', 'ready');
    expect(calls).toBe(1);
    clearMediaStatus('b');
    expect(getMediaStatus('b')).toBe('loading');
    expect(calls).toBe(2);
    unsub();
  });
});
