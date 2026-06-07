import { describe, expect, it } from 'vitest';
import { easeInOut, interpolateSurfaces, lerp } from '@/timeline/transition';
import type { Surface, Vec2 } from '@/types';

function surface(id: string, x: number, opacity = 1): Surface {
  const cp: Vec2[] = [
    { x, y: 0 },
    { x: x + 0.1, y: 0 },
    { x: x + 0.1, y: 0.1 },
    { x, y: 0.1 },
  ];
  return {
    id,
    name: id,
    warpMode: 'quad',
    controlPoints: cp,
    gridSize: { cols: 3, rows: 3 },
    mask: undefined,
    layers: [],
    blendZones: [],
    output: 0,
    visible: true,
    locked: false,
    opacity,
  };
}

describe('lerp / easeInOut', () => {
  it('interpole et lisse aux bornes', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBeCloseTo(0.5);
    expect(easeInOut(0.25)).toBeLessThan(0.25); // accélération initiale
  });
});

describe('interpolateSurfaces', () => {
  const from = [surface('s', 0)];
  const to = [surface('s', 0.5)];

  it('cut : bascule à la fin sans interpolation', () => {
    expect(interpolateSurfaces(from, to, 0.4, 'cut')[0].controlPoints[0].x).toBe(0);
    expect(interpolateSurfaces(from, to, 1, 'cut')[0].controlPoints[0].x).toBe(0.5);
  });

  it('morph : interpole la géométrie des surfaces communes', () => {
    const mid = interpolateSurfaces(from, to, 0.5, 'morph');
    // easeInOut(0.5)=0.5 → milieu géométrique 0.25.
    expect(mid[0].controlPoints[0].x).toBeCloseTo(0.25);
    expect(interpolateSurfaces(from, to, 0, 'morph')[0].controlPoints[0].x).toBeCloseTo(0);
    expect(interpolateSurfaces(from, to, 1, 'morph')[0].controlPoints[0].x).toBeCloseTo(0.5);
  });

  it('fade : géométrie figée sur la cible, opacité interpolée', () => {
    const a = [surface('s', 0, 1)];
    const b = [surface('s', 0.5, 0)];
    const mid = interpolateSurfaces(a, b, 0.5, 'fade');
    expect(mid[0].controlPoints[0].x).toBeCloseTo(0.5); // géométrie = cible
    expect(mid[0].opacity).toBeCloseTo(0.5); // opacité interpolée
  });

  it('fondu entrant des surfaces nouvelles, fondu sortant des supprimées', () => {
    const a = [surface('old', 0, 1)];
    const b = [surface('new', 0.5, 1)];
    const mid = interpolateSurfaces(a, b, 0.25, 'morph');
    const created = mid.find((s) => s.id === 'new')!;
    const removed = mid.find((s) => s.id === 'old')!;
    expect(created.opacity).toBeCloseTo(0.25); // entrant
    expect(removed.opacity).toBeCloseTo(0.75); // sortant
  });

  it('ne mute pas les surfaces d’entrée (copie profonde)', () => {
    const a = [surface('s', 0)];
    const b = [surface('s', 0.5)];
    interpolateSurfaces(a, b, 0.5, 'morph');
    expect(a[0].controlPoints[0].x).toBe(0); // inchangé
  });
});
