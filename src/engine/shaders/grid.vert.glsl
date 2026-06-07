// Grille (mesh warp) — vertex shader.
// UV linéaire (attribut `uv` injecté par Three.js), exprimé en vec3 homogène
// avec q=1 pour réutiliser le même fragment shader que le quad.
varying vec3 vUvq;
varying vec2 vWorld;

void main() {
  vUvq = vec3(uv, 1.0);
  vWorld = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
