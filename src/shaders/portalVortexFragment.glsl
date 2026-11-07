/**
 * shaders/portalVortexFragment.glsl
 * Ethereal Portal Vortex Membrane fragment shader.
 *
 * Implements:
 * - Cosmic radiant doorway opening into another dimension (TARGET_01–02)
 * - Swirling logarithmic vortex energy flowing toward the core
 * - High-luminance celestial core emitting volumetric backlight
 * - Translucent outer rim blending seamlessly into the carved stone megalith
 */

precision highp float;

uniform float uTime;
uniform vec3  uColorCore;    // Radiant inner core (white-hot / luminous violet)
uniform vec3  uColorMid;     // Mid vortex body (amethyst / celestial cyan)
uniform vec3  uColorRim;     // Outer rim boundary (deep indigo / magenta)
uniform float uIntensity;

varying vec2 vUv;
varying vec3 vWorldPos;

void main() {
  // Convert UV to centered radial coordinates [-1, 1]
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);

  // Hard discard outside circular portal aperture
  if (r > 1.0) discard;

  float theta = atan(p.y, p.x);

  // Logarithmic spiral vortex coordinates
  float spiral = theta * 3.0 + log(max(0.01, r)) * 4.0 - uTime * 2.0;
  float energyArms = sin(spiral) * 0.5 + 0.5;
  energyArms = pow(energyArms, 2.5);

  // Concentric ripple rings
  float rings = sin(r * 22.0 - uTime * 3.5) * 0.25 + 0.75;

  // Blinding celestial core glow (center opening into another dimension)
  float coreGlow = pow(1.0 - smoothstep(0.0, 0.75, r), 2.2);

  // Outer rim softening against stone arch
  float rimAlpha = smoothstep(1.0, 0.75, r);

  // Spectral color blend
  vec3 col = mix(uColorMid, uColorRim, smoothstep(0.2, 0.9, r));
  col = mix(col, uColorCore, coreGlow * 0.92);

  // Add shimmering energy filaments
  col += uColorMid * energyArms * (1.0 - r * 0.6) * 1.4;
  col *= rings;

  // Luminous alpha composition
  float alpha = rimAlpha * (0.35 + coreGlow * 0.60 + energyArms * 0.25) * uIntensity;
  alpha = clamp(alpha, 0.0, 0.95);

  gl_FragColor = vec4(col * alpha * 1.8, alpha);
}
