// Quad warp — vertex shader.
// aUvq = (u*q, v*q, q) : coordonnées de texture pré-multipliées par le poids
// homogène q pour un mapping projectif (perspective-correct).
// vWorld : position normalisée en espace sortie (pour le masque).
attribute vec3 aUvq;
varying vec3 vUvq;
varying vec2 vWorld;

void main() {
  vUvq = aUvq;
  vWorld = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
