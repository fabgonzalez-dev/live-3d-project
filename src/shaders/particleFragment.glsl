/**
 * shaders/particleFragment.glsl
 * Particle fragment shader.
 * Renders saturated crystalline stars matching the palette:
 * - Rich jewel tones (electric blue, neon magenta, cyan)
 * - Tiny white-hot diamond cores (not washed out white squares)
 * - 4-point star glints and soft luminous pinpricks
 */

precision highp float;

uniform vec3  uParticleColor;
uniform float uTime;

varying float vBrightness;
varying float vPhase;
varying float vLayer;
varying float vAlpha;

// Dreamy soft bokeh disc mask (stream-optimized: avoids single-pixel flicker)
float discMask(vec2 uv) {
  float d = length(uv - 0.5);
  // Quadratic Gaussian-like falloff for soft, dreamy out-of-focus circle of confusion
  return clamp(1.0 - smoothstep(0.0, 0.5, d), 0.0, 1.0) * pow(max(1.0 - d * 2.0, 0.0), 1.2);
}

// Gentle 4-point star glint with smooth lobes
float starMask(vec2 uv) {
  vec2 c = uv - 0.5;
  float dist = length(c);
  if (dist > 0.5) return 0.0;

  float angle = atan(c.y, c.x);
  float lobe = pow(abs(cos(angle * 2.0)), 8.0);
  float spikes = lobe * smoothstep(0.5, 0.0, dist);
  float core = smoothstep(0.20, 0.0, dist);

  return clamp(spikes * 0.7 + core * 1.3, 0.0, 1.8);
}

void main() {
  vec2 uv = gl_PointCoord;
  float distFromCenter = length(uv - 0.5);

  // Alternate between dreamy soft bokeh discs (70%) and gentle star glints (30%)
  float mask = (vPhase < 4.4) ? discMask(uv) : starMask(uv);
  if (mask < 0.01) discard;

  // Slow, serene hypnotic twinkle (T ~ 3.5s per breath)
  float twinkle = sin(uTime * 1.8 + vPhase * 6.2831853) * 0.25 + 0.75;
  float intensity = vAlpha * twinkle * mask;

  // Rich saturated jewel color: palette color is primary
  vec3 color = uParticleColor;

  // Subtle layer variations (foreground slightly lighter, wall-adjacent deeper)
  if (vLayer < 0.5) {
    color = mix(color, vec3(0.85, 0.95, 1.0), 0.25);
  } else if (vLayer > 1.5) {
    color = mix(color, uParticleColor * 1.2, 0.3);
  }

  // Only the tiny pinprick center core (r < 0.12) is diamond-white hot!
  float whiteCore = smoothstep(0.14, 0.0, distFromCenter);
  color = mix(color, vec3(1.0, 1.0, 1.0), whiteCore * 0.85);

  gl_FragColor = vec4(color * intensity * 1.4, intensity);
}
