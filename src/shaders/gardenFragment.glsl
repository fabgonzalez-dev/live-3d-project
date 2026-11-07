/**
 * shaders/gardenFragment.glsl
 * Cosmic Garden radial form fragment shader.
 *
 * Renders luminous, sacred geometry blossoming petals:
 * - Radial petal fluting and translucent venation
 * - Radiant blooming rim glow
 * - Multi-hue palette gradients
 */

precision highp float;

uniform float uTime;
uniform vec3  uColorCore;    // glowing center
uniform vec3  uColorMid;     // petal body
uniform vec3  uColorRim;     // luminous petal rim
uniform float uIntensity;

varying vec2  vUv;
varying vec3  vWorldPos;
varying float vRing;

void main() {
  float r = length(vWorldPos.xy);
  float angle = atan(vWorldPos.y, vWorldPos.x);

  // Radial petal veins
  float petals = 6.0 + vRing * 2.0;
  float vein = pow(abs(cos(angle * petals * 0.5)), 4.0);

  // Edge and rim glow
  float rim = smoothstep(0.3, 0.95, vUv.y);
  float centerGlow = 1.0 - smoothstep(0.0, 3.5, r);

  // Radial color gradient
  vec3 color = mix(uColorCore, uColorMid, smoothstep(0.5, 4.0, r));
  color = mix(color, uColorRim, rim * 0.7);

  // Add luminous veins and center core
  color += uColorRim * vein * 0.45;
  color += uColorCore * centerGlow * 1.2;

  float alpha = (0.25 + rim * 0.5 + vein * 0.25 + centerGlow * 0.5) * uIntensity;
  alpha = clamp(alpha, 0.0, 0.95);

  gl_FragColor = vec4(color * alpha * 1.5, alpha);
}
