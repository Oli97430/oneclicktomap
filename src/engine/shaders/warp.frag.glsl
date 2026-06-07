// Fragment shader partagé (quad + grille).
// Division perspective : uv = (u*q, v*q) / q. Masque appliqué en espace sortie.
//
// La sortie est PRÉ-MULTIPLIÉE vers l'identité du mode de fusion (noir pour
// normal/add/screen, blanc pour multiply). Ainsi l'opacité et le masque, encodés
// dans le facteur `a`, agissent dans TOUS les modes — y compris multiply/screen
// dont les fonctions de blending n'utilisent pas l'alpha source.
uniform sampler2D uMap;
uniform float uOpacity;
uniform sampler2D uMask;
uniform bool uUseMask;
uniform vec3 uBlendIdentity;
// Edge blending : largeur (fraction) et gamma par bord [gauche, droite, haut, bas].
uniform vec4 uBlendSize;
uniform vec4 uBlendGamma;
varying vec3 vUvq;
varying vec2 vWorld;

float edgeFactor(float dist, float size, float gamma) {
  if (size <= 0.0) return 1.0;
  return pow(clamp(dist / size, 0.0, 1.0), gamma);
}

void main() {
  vec2 uv = vUvq.xy / vUvq.z;
  vec4 tex = texture2D(uMap, uv);
  // Atténuation d'edge-blending (fondu vers les bords pour recouvrement projecteurs).
  float edge = edgeFactor(uv.x, uBlendSize.x, uBlendGamma.x) *
    edgeFactor(1.0 - uv.x, uBlendSize.y, uBlendGamma.y) *
    edgeFactor(1.0 - uv.y, uBlendSize.z, uBlendGamma.z) *
    edgeFactor(uv.y, uBlendSize.w, uBlendGamma.w);
  float a = tex.a * uOpacity * edge;
  if (uUseMask) {
    // vWorld est en y-haut ; la texture de masque est en haut-gauche (flipY=false).
    a *= texture2D(uMask, vec2(vWorld.x, 1.0 - vWorld.y)).a;
  }
  gl_FragColor = vec4(mix(uBlendIdentity, tex.rgb, a), a);
}
