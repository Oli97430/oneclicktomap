export interface ShaderPreset {
  id: string;
  name: string;
  code: string;
}

/**
 * Presets de shaders génératifs. Chaque `code` est un fragment GLSL utilisant
 * `vUv` (0..1), `uTime`, `uResolution` et les helpers du préambule
 * (hash/noise/fbm/hsv2rgb). Voir GENERATIVE_PRELUDE.
 */
export const SHADER_PRESETS: ShaderPreset[] = [
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

export const DEFAULT_PRESET = SHADER_PRESETS[0];
