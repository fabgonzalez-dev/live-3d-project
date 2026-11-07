/**
 * shaders/cityVertex.glsl
 * Hyperdimensional Sci-Fi Architectural Tunnel Hull vertex shader.
 *
 * Implements:
 * - Cylindrical tunnel corridor with periodic chamber expansion (Section 8.5)
 * - Subtle organic spiral twist and radial breathing
 * - Smooth forward coordinate propagation
 */

precision highp float;

uniform float uTime;
uniform float uTravelOffset;
uniform float uDisplacementAmp;
uniform float uTwistAmount;

varying vec3  vWorldPos;
varying vec2  vUv;
varying float vRadius;
varying float vDepth;

void main() {
  vUv = uv;

  vec3 pos = position;

  // Polar coordinates
  float theta = atan(pos.y, pos.x);
  float r = length(pos.xy);

  // Periodic architectural chamber expansion / contraction (radius breathing)
  float chamberWave = sin(pos.z * 0.045 - uTravelOffset * 3.5) * 0.22;
  float expandedRadius = r * (1.0 + chamberWave * uDisplacementAmp);

  // Subtle spiral twist along corridor
  float twist = theta + pos.z * 0.015 * uTwistAmount;
  pos.xy = vec2(cos(twist), sin(twist)) * expandedRadius;

  vRadius = expandedRadius;
  vDepth = pos.z;

  vec4 worldPos = modelMatrix * vec4(pos, 1.0);
  vWorldPos = worldPos.xyz;

  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
