/**
 * Presets de shaders génératifs.
 *
 * Convention pour les paramètres exposés en UI :
 *   uniform float uP_name;  // [min, max, default]  label: Libellé
 *
 * Le préambule (uTime, uResolution, uBass…, hash/noise/fbm/hsv2rgb, vUv) est
 * injecté automatiquement avant le code par GenerativeTexture.
 */

export type PresetCategory = 'base' | 'audio' | 'avance';

export interface ShaderPreset {
  id: string;
  name: string;
  category: PresetCategory;
  code: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Effets de base
// ──────────────────────────────────────────────────────────────────────────────
const BASE_PRESETS: ShaderPreset[] = [
  {
    id: 'plasma',
    name: 'Plasma',
    category: 'base',
    code: `uniform float uP_scale;  // [1.0, 12.0, 6.0]  label: Échelle
uniform float uP_speed;  // [0.1, 5.0, 1.0]    label: Vitesse
void main() {
  vec2 uv = vUv * uP_scale;
  float t = uTime * uP_speed;
  float v = sin(uv.x + t) + sin(uv.y + t * 1.3) + sin(uv.x + uv.y + t * 0.7);
  v += sin(length(uv - uP_scale * 0.5) - t * 2.0);
  gl_FragColor = vec4(hsv2rgb(vec3(0.6 + 0.25 * sin(v), 0.7, 0.95)), 1.0);
}`,
  },
  {
    id: 'fbm',
    name: 'Nuages (fbm)',
    category: 'base',
    code: `uniform float uP_scale;  // [1.0, 8.0, 4.0]    label: Échelle
uniform float uP_speed;  // [0.01, 0.5, 0.1]   label: Vitesse
void main() {
  vec2 p = vUv * uP_scale + vec2(uTime * uP_speed, uTime * uP_speed * 0.5);
  float n = fbm(p);
  gl_FragColor = vec4(mix(vec3(0.05, 0.1, 0.25), vec3(0.9), n), 1.0);
}`,
  },
  {
    id: 'voronoi',
    name: 'Voronoï',
    category: 'base',
    code: `uniform float uP_scale;  // [2.0, 16.0, 8.0]  label: Échelle
uniform float uP_speed;  // [0.1, 3.0, 1.0]    label: Vitesse
void main() {
  vec2 p = vUv * uP_scale;
  vec2 g = floor(p), f = fract(p);
  float md = 1.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 o = vec2(float(x), float(y));
      vec2 rnd = vec2(hash(g + o), hash(g + o + 5.0));
      vec2 r = o + rnd + 0.3 * sin(uTime * uP_speed + 6.2831 * rnd) - f;
      md = min(md, dot(r, r));
    }
  }
  float d = sqrt(md);
  gl_FragColor = vec4(hsv2rgb(vec3(0.55 + 0.3 * d, 0.6, 1.0 - d)), 1.0);
}`,
  },
  {
    id: 'rings',
    name: 'Anneaux',
    category: 'base',
    code: `uniform float uP_freq;   // [5.0, 60.0, 40.0]  label: Fréquence
uniform float uP_speed;  // [0.1, 10.0, 3.0]   label: Vitesse
void main() {
  float d = length(vUv - 0.5);
  float r = sin(d * uP_freq - uTime * uP_speed) * 0.5 + 0.5;
  gl_FragColor = vec4(hsv2rgb(vec3(0.5 + 0.2 * r, 0.5, r)), 1.0);
}`,
  },
  {
    id: 'tunnel',
    name: 'Tunnel',
    category: 'base',
    code: `uniform float uP_speed;  // [0.2, 8.0, 2.0]   label: Vitesse
uniform float uP_twist;  // [1.0, 10.0, 5.0]  label: Spirale
void main() {
  vec2 p = vUv - 0.5;
  float a = atan(p.y, p.x);
  float r = length(p);
  float v = sin(1.0 / max(r, 0.001) * 2.0 + uTime * uP_speed + a * uP_twist) * 0.5 + 0.5;
  gl_FragColor = vec4(hsv2rgb(vec3(fract(a / 6.2831 + uTime * 0.1), 0.6, v)), 1.0);
}`,
  },
  {
    id: 'gradient',
    name: 'Dégradé',
    category: 'base',
    code: `uniform float uP_speed;  // [0.0, 1.0, 0.1]  label: Vitesse
uniform float uP_sat;    // [0.0, 1.0, 0.7]  label: Saturation
void main() {
  float t = fract(vUv.x + uTime * uP_speed);
  gl_FragColor = vec4(hsv2rgb(vec3(t, uP_sat, 0.9)), 1.0);
}`,
  },
  {
    id: 'grid',
    name: 'Grille néon',
    category: 'base',
    code: `uniform float uP_scale;  // [2.0, 30.0, 10.0]  label: Densité
uniform float uP_speed;  // [0.0, 0.5, 0.15]   label: Vitesse
void main() {
  vec2 g = abs(fract(vUv * uP_scale + uTime * uP_speed) - 0.5);
  float l = smoothstep(0.46, 0.5, max(g.x, g.y));
  gl_FragColor = vec4(vec3(0.1, 0.8, 1.0) * l, 1.0);
}`,
  },
  {
    id: 'waves',
    name: 'Ondes',
    category: 'base',
    code: `uniform float uP_freq;   // [2.0, 30.0, 12.0]   label: Fréquence
uniform float uP_amp;    // [0.05, 0.45, 0.25]  label: Amplitude
uniform float uP_speed;  // [0.2, 10.0, 2.0]    label: Vitesse
void main() {
  float y = 0.5 + uP_amp * sin(vUv.x * uP_freq + uTime * uP_speed);
  float m = smoothstep(0.02, 0.0, abs(vUv.y - y));
  gl_FragColor = vec4(mix(vec3(0.02, 0.03, 0.08), vec3(0.3, 0.9, 0.7), m), 1.0);
}`,
  },
  {
    id: 'stripes',
    name: 'Rayures',
    category: 'base',
    code: `uniform float uP_freq;   // [5.0, 60.0, 30.0]  label: Fréquence
uniform float uP_speed;  // [0.2, 10.0, 3.0]   label: Vitesse
void main() {
  float s = sin((vUv.x + vUv.y) * uP_freq + uTime * uP_speed) * 0.5 + 0.5;
  gl_FragColor = vec4(hsv2rgb(vec3(0.8, 0.5, s)), 1.0);
}`,
  },
  {
    id: 'checker',
    name: 'Damier animé',
    category: 'base',
    code: `uniform float uP_scale;  // [2.0, 20.0, 8.0]  label: Échelle
uniform float uP_speed;  // [0.1, 3.0, 1.0]   label: Vitesse
void main() {
  vec2 c = floor(vUv * uP_scale + vec2(sin(uTime * uP_speed), cos(uTime * uP_speed)));
  float v = mod(c.x + c.y, 2.0);
  gl_FragColor = vec4(mix(vec3(0.1), vec3(0.9), v), 1.0);
}`,
  },
  {
    id: 'sparkle',
    name: 'Scintillement',
    category: 'base',
    code: `uniform float uP_density;  // [5.0, 50.0, 20.0]  label: Densité
uniform float uP_speed;    // [1.0, 20.0, 4.0]    label: Vitesse
void main() {
  vec2 p = vUv * uP_density;
  float n = hash(floor(p) + floor(uTime * uP_speed));
  float tw = step(0.9, n) * (sin(uTime * 10.0 + n * 30.0) * 0.5 + 0.5);
  gl_FragColor = vec4(vec3(tw), 1.0);
}`,
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// Audio-réactif (uBass, uMid, uTreble, uLevel, uBeat disponibles)
// ──────────────────────────────────────────────────────────────────────────────
const AUDIO_PRESETS: ShaderPreset[] = [
  {
    id: 'audio-bars',
    name: '♪ Spectre',
    category: 'audio',
    code: `uniform float uP_gain;  // [0.5, 3.0, 1.6]  label: Gain
void main() {
  float x = vUv.x;
  float band = x < 0.34 ? uBass : (x < 0.67 ? uMid : uTreble);
  float h = clamp(band * uP_gain, 0.0, 1.0);
  float m = step(1.0 - h, vUv.y);
  vec3 col = hsv2rgb(vec3(0.6 - x * 0.45, 0.85, 1.0));
  gl_FragColor = vec4(col * m, 1.0);
}`,
  },
  {
    id: 'audio-pulse',
    name: '♪ Pulsation',
    category: 'audio',
    code: `uniform float uP_sensitivity;  // [0.1, 1.0, 0.4]  label: Sensibilité
void main() {
  float d = length(vUv - 0.5);
  float r = 0.12 + uLevel * uP_sensitivity + uBeat * uP_sensitivity * 0.5;
  float ring = smoothstep(r + 0.03, r, d) * smoothstep(r - 0.12, r, d);
  vec3 col = hsv2rgb(vec3(0.55 + uBass * 0.3, 0.8, 0.6 + uBeat * 0.4));
  gl_FragColor = vec4(col * (ring + uLevel * 0.25), 1.0);
}`,
  },
  {
    id: 'feedback',
    name: '♪ Résonance',
    category: 'audio',
    code: `uniform float uP_decay;  // [0.5, 0.99, 0.85]  label: Déclin
void main() {
  vec2 p = vUv - 0.5;
  float r = length(p) * 3.0;
  float a = atan(p.y, p.x);
  float beat = uBeat * 0.4 + uLevel * 0.3;
  float ring  = sin(r * 8.0  - uTime * 4.0 + uBass * 6.0) * 0.5 + 0.5;
  float ring2 = sin(r * 12.0 - uTime * 3.5 + uMid  * 5.0) * 0.5 + 0.5;
  float bloom = exp(-r * (1.5 - beat));
  vec3 col = hsv2rgb(vec3(0.55 + uBass * 0.25 + a / 6.2832, 0.7 + uMid * 0.2, (ring + ring2) * 0.5 * bloom));
  gl_FragColor = vec4(col * uP_decay + uLevel * 0.1, 1.0);
}`,
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// Avancé (D5 — Phase 9)
// ──────────────────────────────────────────────────────────────────────────────
const ADVANCED_PRESETS: ShaderPreset[] = [
  {
    id: 'glitch',
    name: 'Glitch',
    category: 'avance',
    code: `uniform float uP_intensity;  // [0.0, 1.0, 0.5]  label: Intensité
uniform float uP_speed;      // [0.1, 5.0, 1.0]    label: Vitesse
void main() {
  float t = floor(uTime * uP_speed * 4.0) * 0.25;
  float band = floor(vUv.y * 16.0 + t * 7.0);
  float rnd  = hash(vec2(band, t));
  float shift = (step(0.9 - uP_intensity * 0.5, rnd) - 0.5) * uP_intensity * 0.15;
  vec2 uv1 = fract(vUv + vec2(shift, 0.0));
  vec2 uv2 = fract(vUv + vec2(-shift * 0.7, 0.0));
  float r = fbm(uv1 * 3.0 + uTime * 0.3);
  float g = fbm(uv2 * 3.0 + uTime * 0.3 + 5.3);
  float b = fbm(fract(vUv + vec2(shift * 0.4)) * 3.0 + uTime * 0.3 + 11.1);
  float scan = step(0.95, fract(vUv.y * uResolution.y * 0.5));
  gl_FragColor = vec4(vec3(r, g, b) * (1.0 - scan * 0.6 * uP_intensity), 1.0);
}`,
  },
  {
    id: 'kaleidoscope',
    name: 'Kaléidoscope',
    category: 'avance',
    code: `uniform float uP_slices;  // [2.0, 16.0, 6.0]  label: Sections
uniform float uP_zoom;    // [0.5, 4.0, 1.5]    label: Zoom
void main() {
  vec2 p = vUv - 0.5;
  float angle = atan(p.y, p.x);
  float r = length(p);
  float sectors = round(uP_slices);
  float a = mod(angle, 6.2832 / sectors);
  if (a > 3.1416 / sectors) a = 6.2832 / sectors - a;
  vec2 q = vec2(cos(a), sin(a)) * r * uP_zoom + 0.5;
  float n = fbm(q * 3.0 + uTime * 0.15);
  gl_FragColor = vec4(hsv2rgb(vec3(0.6 + 0.3 * n + uTime * 0.04, 0.7, 0.85)), 1.0);
}`,
  },
  {
    id: 'fire',
    name: 'Feu',
    category: 'avance',
    code: `uniform float uP_heat;  // [0.3, 2.0, 1.0]  label: Chaleur
void main() {
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * vec2(3.0, 4.0 * uP_heat);
  float f1 = fbm(p + vec2(uTime * 0.3,  uTime * 1.2));
  float f2 = fbm(p + vec2(-uTime * 0.2, uTime * 0.9) + 4.0);
  float flame = clamp((f1 + f2) * 0.6 - vUv.y * 1.4 * uP_heat, 0.0, 1.0);
  vec3 col = mix(vec3(0.0), vec3(1.0, 0.4, 0.0), flame);
  col = mix(col, vec3(1.0, 1.0, 0.4), pow(flame, 3.0));
  gl_FragColor = vec4(col, 1.0);
}`,
  },
  {
    id: 'matrix',
    name: 'Pluie matricielle',
    category: 'avance',
    code: `uniform float uP_density;  // [4.0, 32.0, 12.0]  label: Densité
uniform float uP_gspeed;   // [0.1, 3.0, 1.0]     label: Vitesse
void main() {
  float cols = round(uP_density);
  vec2 cell = vec2(floor(vUv.x * cols), vUv.y);
  float offset = hash(vec2(cell.x, 0.0));
  float drop = fract(offset * 5.13 + uTime * uP_gspeed * 0.4 * (0.5 + offset));
  float head = smoothstep(0.0, 0.04, drop - (1.0 - cell.y)) *
               smoothstep(0.0, 0.04, cell.y - (1.0 - drop));
  float trail = smoothstep(0.0, 0.35, drop - (1.0 - cell.y)) * (1.0 - cell.y / drop);
  float glyph = step(0.6, hash(vec2(cell.x, floor(cell.y * 24.0) + floor(uTime * 8.0))));
  float bright = (head + trail * 0.4) * glyph;
  gl_FragColor = vec4(0.0, bright, bright * 0.3, 1.0);
}`,
  },
  {
    id: 'lissajous',
    name: 'Lissajous',
    category: 'avance',
    code: `uniform float uP_nx;  // [1.0, 8.0, 3.0]  label: Fréq X
uniform float uP_ny;  // [1.0, 8.0, 4.0]  label: Fréq Y
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float nx = round(uP_nx); float ny = round(uP_ny);
  float phase = uTime * 0.3;
  float dist = 1.0;
  for (float i = 0.0; i < 6.0; i++) {
    float t = i / 6.0 * 6.2832;
    vec2 lp = vec2(sin(nx * t + phase), sin(ny * t));
    dist = min(dist, length(p - lp));
  }
  float line = smoothstep(0.04, 0.0, dist);
  vec3 col = hsv2rgb(vec3(fract(dist * 0.8 + uTime * 0.1), 0.8, line));
  gl_FragColor = vec4(col, 1.0);
}`,
  },
  {
    id: 'displacement',
    name: 'Déplacement',
    category: 'avance',
    code: `uniform float uP_amp;   // [0.0, 0.2, 0.06]  label: Amplitude
uniform float uP_freq;  // [1.0, 12.0, 4.0]  label: Fréquence
void main() {
  vec2 off = vec2(
    fbm(vUv * uP_freq + vec2(uTime * 0.25, 0.0)) - 0.5,
    fbm(vUv * uP_freq + vec2(0.0, uTime * 0.2) + 3.7) - 0.5
  ) * uP_amp * 2.0;
  vec2 uv = fract(vUv + off);
  float n = fbm(uv * 5.0);
  gl_FragColor = vec4(hsv2rgb(vec3(0.5 + n * 0.4 + uTime * 0.05, 0.65, 0.9)), 1.0);
}`,
  },
  {
    id: 'hexagons',
    name: 'Hexagones',
    category: 'avance',
    code: `uniform float uP_scale;  // [2.0, 16.0, 6.0]  label: Échelle
uniform float uP_pulse;  // [0.0, 1.0, 0.5]    label: Pulsation
float hexDist(vec2 p) {
  p = abs(p);
  return max(dot(p, normalize(vec2(1.0, 1.732))), p.x);
}
vec2 hexCoord(vec2 p, float s) {
  vec2 r = vec2(1.0, 1.732) * s;
  vec2 h = r * 0.5;
  vec2 a = mod(p, r) - h;
  vec2 b = mod(p - h, r) - h;
  return dot(a, a) < dot(b, b) ? a : b;
}
void main() {
  vec2 p = (vUv - 0.5) * uP_scale;
  vec2 hc = hexCoord(p, 1.0);
  float d = hexDist(hc);
  float wave = sin(length(p) * 2.0 - uTime * 2.0) * uP_pulse;
  float edge = smoothstep(0.45 + wave * 0.08, 0.5 + wave * 0.08, d);
  float hue = hash(floor(p - hc) + 0.5) + uTime * 0.05;
  vec3 col = mix(hsv2rgb(vec3(hue, 0.7, 0.8)), vec3(0.05), edge);
  gl_FragColor = vec4(col, 1.0);
}`,
  },
];

export const SHADER_PRESETS: ShaderPreset[] = [
  ...BASE_PRESETS,
  ...AUDIO_PRESETS,
  ...ADVANCED_PRESETS,
];

export const DEFAULT_PRESET = SHADER_PRESETS[0];
