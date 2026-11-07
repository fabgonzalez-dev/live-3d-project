/**
 * shaders/portalVortexVertex.glsl
 * Ethereal Portal Vortex Membrane vertex shader.
 *
 * Implements subtle organic membrane ripples and radial breathing.
 */

precision highp float;

uniform float uTime;
uniform float uWaveAmp;

varying vec2 vUv;
varying vec3 vWorldPos;

void main() {
  vUv = uv;

  vec3 pos = position;

  // Radial ripple expanding outward from portal center
  float r = length(pos.xy);
  float ripple = sin(r * 3.5 - uTime * 2.2) * 0.12 * uWaveAmp;
  pos.z += ripple;

  vec4 worldPos = modelMatrix * vec4(pos, 1.0);
  vWorldPos = worldPos.xyz;

  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
