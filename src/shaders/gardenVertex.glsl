/**
 * shaders/gardenVertex.glsl
 * Cosmic Garden radial form vertex shader.
 *
 * Displaces petal rings with organic unfolding motion and sacred symmetry.
 */

precision highp float;

uniform float uTime;
uniform float uBreatheScale;
uniform float uTwist;

attribute float aRingIndex;  // concentric petal ring index

varying vec2  vUv;
varying vec3  vWorldPos;
varying float vRing;

void main() {
  vUv = uv;
  vRing = aRingIndex;

  vec3 pos = position;

  // Concentric radial breathing and undulating petal folds
  float angle = atan(pos.y, pos.x);
  float radius = length(pos.xy);

  // 6-fold / 8-fold petal fluting
  float petals = 6.0 + aRingIndex * 2.0;
  float petalUndulation = sin(angle * petals + uTime * 0.8 + aRingIndex) * 0.4;
  pos.z += petalUndulation * smoothstep(0.0, 5.0, radius);

  // Slow orbital rotation per ring
  float rot = uTime * (0.05 + aRingIndex * 0.02) * (mod(aRingIndex, 2.0) == 0.0 ? 1.0 : -1.0);
  float c = cos(rot), s = sin(rot);
  vec2 rotXY = vec2(pos.x * c - pos.y * s, pos.x * s + pos.y * c);
  pos.xy = rotXY * (1.0 + sin(uTime * 0.6 + aRingIndex * 0.8) * 0.08 * uBreatheScale);

  vec4 worldPos = modelMatrix * vec4(pos, 1.0);
  vWorldPos = worldPos.xyz;

  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
