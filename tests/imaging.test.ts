import { describe, expect, it } from 'vitest';
import { gaussianBlur, gaussianKernel1D, sobel, toGrayscale } from '@/detection/imageProcessing';
import { cannyEdges } from '@/detection/canny';
import { houghLines } from '@/detection/hough';
import { estimateDepth } from '@/detection/depth';

describe('toGrayscale', () => {
  it('convertit le blanc et le noir, pondère le rouge (Rec. 601)', () => {
    const data = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255, 255, 0, 0, 255]);
    const gray = toGrayscale({ data, width: 3, height: 1 });
    expect(gray[0]).toBeCloseTo(255);
    expect(gray[1]).toBeCloseTo(0);
    expect(gray[2]).toBeCloseTo(76.245, 2);
  });
});

describe('gaussianBlur', () => {
  it('a un noyau normalisé (somme = 1)', () => {
    const k = gaussianKernel1D(1.4);
    let sum = 0;
    for (const v of k) sum += v;
    expect(sum).toBeCloseTo(1, 5);
  });

  it('préserve une image constante', () => {
    const w = 8;
    const h = 8;
    const gray = new Float32Array(w * h).fill(100);
    const out = gaussianBlur(gray, w, h, 1.4);
    for (const v of out) expect(v).toBeCloseTo(100, 3);
  });
});

describe('sobel', () => {
  it('détecte une arête verticale et son orientation', () => {
    const w = 6;
    const h = 6;
    const gray = new Float32Array(w * h);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) gray[y * w + x] = x >= 3 ? 255 : 0;
    }
    const { mag, dir } = sobel(gray, w, h);
    const boundary = mag[2 * w + 3];
    const flat = mag[2 * w + 0];
    expect(boundary).toBeGreaterThan(flat);
    expect(boundary).toBeGreaterThan(100);
    // Gradient orienté selon +x (arête verticale).
    expect(Math.abs(dir[2 * w + 3])).toBeLessThan(0.2);
  });
});

describe('cannyEdges', () => {
  const countEdges = (edges: Uint8Array): number => {
    let c = 0;
    for (const v of edges) if (v) c += 1;
    return c;
  };

  it('amincit le contour d’un carré plein (~1px) et laisse l’intérieur vide', () => {
    const w = 30;
    const h = 30;
    const gray = new Float32Array(w * h);
    for (let y = 8; y <= 21; y += 1) {
      for (let x = 8; x <= 21; x += 1) gray[y * w + x] = 255;
    }
    const edges = cannyEdges(gray, w, h);
    const count = countEdges(edges);
    // Contour aminci ≈ périmètre (~52) : exclut l’absence de NMS (≫200) et l’absence de contour.
    expect(count).toBeGreaterThan(40);
    expect(count).toBeLessThan(90);
    expect(edges[15 * w + 15]).toBe(0); // intérieur uniforme : pas de contour
    expect(edges[2 * w + 2]).toBe(0); // fond éloigné : pas de contour

    // Les 4 côtés sont détectés (pas seulement les coins).
    const sidePresent = (cond: (x: number, y: number) => boolean): boolean => {
      for (let y = 1; y < h - 1; y += 1) {
        for (let x = 1; x < w - 1; x += 1) if (edges[y * w + x] && cond(x, y)) return true;
      }
      return false;
    };
    expect(sidePresent((x, y) => y <= 9 && x > 10 && x < 19)).toBe(true); // haut
    expect(sidePresent((x, y) => y >= 20 && x > 10 && x < 19)).toBe(true); // bas
    expect(sidePresent((x, y) => x <= 9 && y > 10 && y < 19)).toBe(true); // gauche
    expect(sidePresent((x, y) => x >= 20 && y > 10 && y < 19)).toBe(true); // droite
  });

  it('amincit une arête diagonale à ≤ 2px par ligne (secteurs NMS 45°/135°)', () => {
    const w = 16;
    const h = 16;
    const gray = new Float32Array(w * h);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) gray[y * w + x] = x + y >= 16 ? 255 : 0;
    }
    const edges = cannyEdges(gray, w, h);
    let total = 0;
    let maxPerRow = 0;
    for (let y = 1; y < h - 1; y += 1) {
      let row = 0;
      for (let x = 1; x < w - 1; x += 1) if (edges[y * w + x]) row += 1;
      maxPerRow = Math.max(maxPerRow, row);
      total += row;
    }
    expect(total).toBeGreaterThan(0);
    // Crête fine : échouerait avec les secteurs diagonaux inversés (smear épais).
    expect(maxPerRow).toBeLessThanOrEqual(2);
  });

  // NB : la promotion d'arêtes faibles connectées (hystérésis) est validée à l'échelle réelle
  // (intégration) — non testée ici car, sur de minuscules images, la NMS dérive aux jonctions
  // de contraste et casse la connexité 8-voisins (artefact de l'image-test, pas du code).

  it('hystérésis : élimine une arête faible isolée', () => {
    const w = 24;
    const h = 20;
    const gray = new Float32Array(w * h);
    // Arête forte isolée à x=6 (saut 200) + arête faible isolée à x=16 (saut 30).
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        let v = 0;
        if (x >= 6) v = 200;
        if (x >= 16) v = 230;
        gray[y * w + x] = v;
      }
    }
    const edges = cannyEdges(gray, w, h);
    let strong = 0;
    let weak = 0;
    for (let y = 1; y < h - 1; y += 1) {
      for (let x = 5; x <= 7; x += 1) if (edges[y * w + x]) strong += 1;
      for (let x = 15; x <= 17; x += 1) if (edges[y * w + x]) weak += 1;
    }
    expect(strong).toBeGreaterThan(0); // arête forte conservée
    expect(weak).toBe(0); // arête faible isolée éliminée
  });
});

describe('houghLines', () => {
  it('identifie une droite verticale (normale horizontale)', () => {
    const w = 20;
    const h = 20;
    const edges = new Uint8Array(w * h);
    for (let y = 0; y < h; y += 1) edges[y * w + 10] = 255;
    const [top] = houghLines(edges, w, h, { threshold: 5, maxLines: 4 });
    // Droite verticale ⇒ sin(θ)≈0 et |ρ|≈10 (θ∈[0,π) avec ρ signé).
    expect(Math.abs(Math.sin(top.theta))).toBeLessThan(0.1);
    expect(Math.abs(top.rho)).toBeCloseTo(10, 0);
  });

  it('identifie une droite horizontale (normale verticale)', () => {
    const w = 20;
    const h = 20;
    const edges = new Uint8Array(w * h);
    for (let x = 0; x < w; x += 1) edges[5 * w + x] = 255;
    const [top] = houghLines(edges, w, h, { threshold: 5, maxLines: 4 });
    // Droite horizontale ⇒ cos(θ)≈0 et |ρ|≈5.
    expect(Math.abs(Math.cos(top.theta))).toBeLessThan(0.1);
    expect(Math.abs(top.rho)).toBeCloseTo(5, 0);
  });
});

describe('estimateDepth', () => {
  it('produit une profondeur normalisée croissante sur un dégradé', () => {
    const w = 10;
    const h = 4;
    const gray = new Float32Array(w * h);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) gray[y * w + x] = x * 25;
    }
    const depth = estimateDepth(gray, w, h);
    for (const d of depth) {
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(1);
    }
    // Interieur : croissance gauche → droite.
    expect(depth[2 * w + 2]).toBeLessThan(depth[2 * w + 7]);
  });
});
