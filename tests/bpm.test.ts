import { describe, expect, it } from 'vitest';
import { beatDurationMs, beatsToMs, quantizeMsToBeat, tapTempo } from '@/utils/bpm';

describe('beatDurationMs / beatsToMs', () => {
  it('convertit BPM ↔ durée', () => {
    expect(beatDurationMs(120)).toBe(500);
    expect(beatDurationMs(60)).toBe(1000);
    expect(beatsToMs(4, 120)).toBe(2000);
    expect(beatDurationMs(0)).toBe(0);
  });
});

describe('tapTempo', () => {
  it('estime le BPM depuis des taps réguliers', () => {
    expect(tapTempo([0, 500, 1000, 1500])).toBe(120);
    expect(tapTempo([0, 1000, 2000])).toBe(60);
  });

  it('renvoie null pour moins de deux taps', () => {
    expect(tapTempo([])).toBeNull();
    expect(tapTempo([100])).toBeNull();
  });

  it('borne le résultat à [20, 300]', () => {
    expect(tapTempo([0, 100])).toBe(300); // 600 bpm -> 300
    expect(tapTempo([0, 5000])).toBe(20); // 12 bpm -> 20
  });
});

describe('quantizeMsToBeat', () => {
  it('aligne sur le temps le plus proche', () => {
    expect(quantizeMsToBeat(740, 120)).toBe(500); // beat=500, 740 -> 500
    expect(quantizeMsToBeat(760, 120)).toBe(1000); // 760 -> 1000
    expect(quantizeMsToBeat(1234, 120, 0)).toBe(1000);
  });
});
