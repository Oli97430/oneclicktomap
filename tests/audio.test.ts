import { describe, expect, it } from 'vitest';
import { analyzeBands, BeatDetector } from '@/content/audioAnalysis';

describe('analyzeBands', () => {
  it('renvoie zéro pour un spectre vide ou silencieux', () => {
    expect(analyzeBands(new Uint8Array(0))).toEqual({ level: 0, bass: 0, mid: 0, treble: 0 });
    const r = analyzeBands(new Uint8Array(100));
    expect(r.level).toBe(0);
    expect(r.bass).toBe(0);
    expect(r.treble).toBe(0);
  });

  it('sature à 1 quand tout le spectre est au maximum', () => {
    const r = analyzeBands(new Uint8Array(100).fill(255));
    expect(r.level).toBeCloseTo(1);
    expect(r.bass).toBeCloseTo(1);
    expect(r.mid).toBeCloseTo(1);
    expect(r.treble).toBeCloseTo(1);
  });

  it("isole l'énergie des basses", () => {
    const data = new Uint8Array(100);
    for (let i = 0; i < 10; i += 1) data[i] = 255;
    const r = analyzeBands(data);
    expect(r.bass).toBeCloseTo(1);
    expect(r.treble).toBe(0);
    expect(r.bass).toBeGreaterThan(r.treble);
  });
});

describe('BeatDetector', () => {
  it('déclenche sur un pic de basses et respecte la période réfractaire', () => {
    const detector = new BeatDetector();
    let t = 0;
    for (let i = 0; i < 15; i += 1) {
      expect(detector.push(0.1, t)).toBe(false); // niveau stable : pas de beat
      t += 20;
    }
    expect(detector.push(0.6, 1000)).toBe(true); // pic -> beat
    expect(detector.push(0.6, 1100)).toBe(false); // < 250 ms : réfractaire
    expect(detector.push(0.6, 1400)).toBe(true); // après la période réfractaire
  });
});
