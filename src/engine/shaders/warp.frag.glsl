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
// Repositionnement du contenu dans la surface (offset uv, échelle, rotation).
uniform vec2 uLayerOffset;
uniform float uLayerScale;
uniform float uLayerRot;
uniform float uLayerAspect;
varying vec3 vUvq;
varying vec2 vWorld;

float edgeFactor(float dist, float size, float gamma) {
  if (size <= 0.0) return 1.0;
  return pow(clamp(dist / size, 0.0, 1.0), gamma);
}

// uv SURFACE -> uv CONTENU à échantillonner (inverse de la transformation
// visuelle). Rotation corrigée par l'aspect pour rester visuellement carrée.
// Miroir exact de contentUvFromSurfaceUv() (src/utils/layerTransform.ts).
vec2 layerContentUv(vec2 uv) {
  vec2 p = uv - vec2(0.5) - uLayerOffset;
  p.x *= uLayerAspect;
  float c = cos(uLayerRot);
  float s = sin(uLayerRot);
  p = mat2(c, -s, s, c) * p;
  p.x /= uLayerAspect;
  p /= max(uLayerScale, 1e-3);
  return p + vec2(0.5);
}

void main() {
  vec2 suv = vUvq.xy / vUvq.z;          // espace surface (edge blending + masque)
  vec2 cuv = layerContentUv(suv);        // espace contenu (échantillonnage texture)
  // Hors du cadre [0,1] du contenu transformé : pixel transparent.
  float inBounds = step(0.0, cuv.x) * step(cuv.x, 1.0) * step(0.0, cuv.y) * step(cuv.y, 1.0);
  vec4 tex = texture2D(uMap, clamp(cuv, 0.0, 1.0));
  // Atténuation d'edge-blending (en espace surface, pour recouvrement projecteurs).
  float edge = edgeFactor(suv.x, uBlendSize.x, uBlendGamma.x) *
    edgeFactor(1.0 - suv.x, uBlendSize.y, uBlendGamma.y) *
    edgeFactor(1.0 - suv.y, uBlendSize.z, uBlendGamma.z) *
    edgeFactor(suv.y, uBlendSize.w, uBlendGamma.w);
  float a = tex.a * uOpacity * edge * inBounds;
  if (uUseMask) {
    // vWorld est en y-haut ; la texture de masque est en haut-gauche (flipY=false).
    a *= texture2D(uMask, vec2(vWorld.x, 1.0 - vWorld.y)).a;
  }
  gl_FragColor = vec4(mix(uBlendIdentity, tex.rgb, a), a);
}
