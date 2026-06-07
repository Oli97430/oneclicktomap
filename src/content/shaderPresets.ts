/** Définition d'un uniform exposé en slider UI (D2 : shader params). */
export interface ShaderParamDef {
  /** Nom du uniform sans le préfixe « uP_ » (ex. "speed"). */
  name: string;
  uniformName: string; // "uP_speed"
  label: string;
  min: number;
  max: number;
  default: number;
  step: number;
}

export interface ShaderPreset {
  id: string;
  name: string;
  code: string;
  /** Params exposés en UI (sous-ensemble des uniforms uP_* du code). */
  params?: ShaderParamDef[];
}

/**
 * Presets de shaders génératifs (base). Chaque `code` est un fragment GLSL utilisant
 * `vUv` (0..1), `uTime`, `uResolution` et les helpers du préambule
 * (hash/noise/fbm/hsv2rgb). Voir GENERATIVE_PRELUDE.
 * Les presets D5 sont en dessous dans PHASE9_PRESETS.
 */
const SHADER_PRESETS_BASE: ShaderPreset[] = [
  {
    id: 'plasma',
    name: 'Plasma',
    code: `void main() {
  vec2 uv = vUv * 6.0;
  float v = sin(uv.x + uTime) + sin(uv.y + uTime * 1.3) + sin(uv.x + uv.y + uTime * 0.7);
  v += sin(length(uv - 3.0) - uTime * 2.0);
  gl_FragColor = vec4(hsv2rgb(vec3(0.6 + 0.25 * sin(v), 0.7, 0.95)), 1.0);
}`,
  },
  {
    id: 'fbm',
    name: 'Nuages (fbm)',
    code: `void main() {
  vec2 p = vUv * 4.0 + vec2(uTime * 0.1, uTime * 0.05);
  float n = fbm(p);
  gl_FragColor = vec4(mix(vec3(0.05, 0.1, 0.25), vec3(0.9), n), 1.0);
}`,
  },
  {
    id: 'voronoi',
    name: 'Voronoi',
    code: `void main() {
  vec2 p = vUv * 8.0;
  vec2 g = floor(p), f = fract(p);
  float md = 1.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 o = vec2(float(x), float(y));
      vec2 rnd = vec2(hash(g + o), hash(g + o + 5.0));
      vec2 r = o + rnd + 0.3 * sin(uTime + 6.2831 * rnd) - f;
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
    code: `void main() {
  float d = length(vUv - 0.5);
  float r = sin(d * 40.0 - uTime * 3.0) * 0.5 + 0.5;
  gl_FragColor = vec4(hsv2rgb(vec3(0.5 + 0.2 * r, 0.5, r)), 1.0);
}`,
  },
  {
    id: 'tunnel',
    name: 'Tunnel',
    code: `void main() {
  vec2 p = vUv - 0.5;
  float a = atan(p.y, p.x);
  float r = length(p);
  float v = sin(1.0 / max(r, 0.001) * 2.0 + uTime * 2.0 + a * 5.0) * 0.5 + 0.5;
  gl_FragColor = vec4(hsv2rgb(vec3(fract(a / 6.2831 + uTime * 0.1), 0.6, v)), 1.0);
}`,
  },
  {
    id: 'gradient',
    name: 'Dégradé',
    code: `void main() {
  float t = fract(vUv.x + uTime * 0.1);
  gl_FragColor = vec4(hsv2rgb(vec3(t, 0.7, 0.9)), 1.0);
}`,
  },
  {
    id: 'grid',
    name: 'Grille néon',
    code: `void main() {
  vec2 g = abs(fract(vUv * 10.0 + uTime * 0.15) - 0.5);
  float l = smoothstep(0.46, 0.5, max(g.x, g.y));
  gl_FragColor = vec4(vec3(0.1, 0.8, 1.0) * l, 1.0);
}`,
  },
  {
    id: 'waves',
    name: 'Ondes',
    code: `void main() {
  float y = 0.5 + 0.25 * sin(vUv.x * 12.0 + uTime * 2.0);
  float m = smoothstep(0.02, 0.0, abs(vUv.y - y));
  gl_FragColor = vec4(mix(vec3(0.02, 0.03, 0.08), vec3(0.3, 0.9, 0.7), m), 1.0);
}`,
  },
  {
    id: 'stripes',
    name: 'Rayures',
    code: `void main() {
  float s = sin((vUv.x + vUv.y) * 30.0 + uTime * 3.0) * 0.5 + 0.5;
  gl_FragColor = vec4(hsv2rgb(vec3(0.8, 0.5, s)), 1.0);
}`,
  },
  {
    id: 'checker',
    name: 'Damier animé',
    code: `void main() {
  vec2 c = floor(vUv * 8.0 + vec2(sin(uTime), cos(uTime)));
  float v = mod(c.x + c.y, 2.0);
  gl_FragColor = vec4(mix(vec3(0.1), vec3(0.9), v), 1.0);
}`,
  },
  {
    id: 'sparkle',
    name: 'Scintillement',
    code: `void main() {
  vec2 p = vUv * 20.0;
  float n = hash(floor(p) + floor(uTime * 4.0));
  float tw = step(0.9, n) * (sin(uTime * 10.0 + n * 30.0) * 0.5 + 0.5);
  gl_FragColor = vec4(vec3(tw), 1.0);
}`,
  },
  {
    id: 'audio-bars',
    name: '♪ Spectre',
    code: `void main() {
  float x = vUv.x;
  float band = x < 0.34 ? uBass : (x < 0.67 ? uMid : uTreble);
  float h = clamp(band * 1.6, 0.0, 1.0);
  float m = step(1.0 - h, vUv.y);
  vec3 col = hsv2rgb(vec3(0.6 - x * 0.45, 0.85, 1.0));
  gl_FragColor = vec4(col * m, 1.0);
}`,
  },
  {
    id: 'audio-pulse',
    name: '♪ Pulsation',
    code: `void main() {
  float d = length(vUv - 0.5);
  float r = 0.12 + uLevel * 0.4 + uBeat * 0.2;
  float ring = smoothstep(r + 0.03, r, d) * smoothstep(r - 0.12, r, d);
  vec3 col = hsv2rgb(vec3(0.55 + uBass * 0.3, 0.8, 0.6 + uBeat * 0.4));
  gl_FragColor = vec4(col * (ring + uLevel * 0.25), 1.0);
}`,
  },
];

// ──────────────────────────────────────────────────────────
// D5 : 8 nouveaux presets génératifs
// ──────────────────────────────────────────────────────────
const PHASE9_PRESETS: ShaderPreset[] = [
  {
    id: 'glitch',
    name: 'Glitch',
    params: [
      { name: 'intensity', uniformName: 'uP_intensity', label: 'Intensité', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'speed', uniformName: 'uP_speed', label: 'Vitesse', min: 0.1, max: 5, default: 1, step: 0.1 },
    ],
    code: `uniform float uP_intensity;
uniform float uP_speed;
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
    params: [
      { name: 'slices', uniformName: 'uP_slices', label: 'Sections', min: 2, max: 16, default: 6, step: 1 },
      { name: 'zoom', uniformName: 'uP_zoom', label: 'Zoom', min: 0.5, max: 4, default: 1.5, step: 0.1 },
    ],
    code: `uniform float uP_slices;
uniform float uP_zoom;
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
    params: [
      { name: 'heat', uniformName: 'uP_heat', label: 'Chaleur', min: 0.3, max: 2, default: 1, step: 0.05 },
    ],
    code: `uniform float uP_heat;
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
    params: [
      { name: 'density', uniformName: 'uP_density', label: 'Densité', min: 4, max: 32, default: 12, step: 1 },
      { name: 'gspeed', uniformName: 'uP_gspeed', label: 'Vitesse', min: 0.1, max: 3, default: 1, step: 0.1 },
    ],
    code: `uniform float uP_density;
uniform float uP_gspeed;
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
    params: [
      { name: 'nx', uniformName: 'uP_nx', label: 'Fréq X', min: 1, max: 8, default: 3, step: 1 },
      { name: 'ny', uniformName: 'uP_ny', label: 'Fréq Y', min: 1, max: 8, default: 4, step: 1 },
    ],
    code: `uniform float uP_nx;
uniform float uP_ny;
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
    params: [
      { name: 'amp', uniformName: 'uP_amp', label: 'Amplitude', min: 0, max: 0.2, default: 0.06, step: 0.005 },
      { name: 'freq', uniformName: 'uP_freq', label: 'Fréquence', min: 1, max: 12, default: 4, step: 0.5 },
    ],
    code: `uniform float uP_amp;
uniform float uP_freq;
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
    params: [
      { name: 'scale', uniformName: 'uP_scale', label: 'Échelle', min: 2, max: 16, default: 6, step: 0.5 },
      { name: 'pulse', uniformName: 'uP_pulse', label: 'Pulsation', min: 0, max: 1, default: 0.5, step: 0.05 },
    ],
    code: `uniform float uP_scale;
uniform float uP_pulse;
// hex grid distance
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
  {
    id: 'feedback',
    name: '♪ Résonance',
    params: [
      { name: 'decay', uniformName: 'uP_decay', label: 'Déclin', min: 0.5, max: 0.99, default: 0.85, step: 0.01 },
    ],
    code: `uniform float uP_decay;
void main() {
  vec2 p = vUv - 0.5;
  float r = length(p) * 3.0;
  float a = atan(p.y, p.x);
  float beat = uBeat * 0.4 + uLevel * 0.3;
  float ring = sin(r * 8.0 - uTime * 4.0 + uBass * 6.0) * 0.5 + 0.5;
  float ring2 = sin(r * 12.0 - uTime * 3.5 + uMid * 5.0) * 0.5 + 0.5;
  float bloom = exp(-r * (1.5 - beat));
  vec3 col = hsv2rgb(vec3(0.55 + uBass * 0.25 + a / 6.2832, 0.7 + uMid * 0.2, (ring + ring2) * 0.5 * bloom));
  gl_FragColor = vec4(col * uP_decay + uLevel * 0.1, 1.0);
}`,
  },
];

export const SHADER_PRESETS: ShaderPreset[] = [...SHADER_PRESETS_BASE, ...PHASE9_PRESETS];
export const DEFAULT_PRESET = SHADER_PRESETS[0];
