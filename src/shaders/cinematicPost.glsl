/**
 * shaders/cinematicPost.glsl
 * Custom full-screen pass for EffectComposer:
 * - Subtle quadratic vignette drawing attention to vanishing corridor
 * - High-frequency triangle dither & film grain (eliminates 8-bit gradient banding)
 * - Filmic contrast curve and saturation control
 * - Subtle radial chromatic aberration
 */

precision highp float;

uniform sampler2D tDiffuse;
uniform vec2      uResolution;
uniform float     uTime;
uniform float     uVignetteStrength;   // default ~0.35
uniform float     uVignetteRadius;     // default ~0.80
uniform float     uGrainIntensity;     // default ~0.02
uniform float     uChromaticAberration;// default ~0.002
uniform float     uContrast;           // default ~1.05
uniform float     uSaturation;         // default ~1.08

varying vec2 vUv;

// Triangular high-pass noise for artifact-free dithering
float ditherTriangular(vec2 p, float time) {
  vec2 seed = p * uResolution + fract(time * 31.4159);
  float n = fract(sin(dot(seed, vec2(12.9898, 78.233))) * 43758.5453);
  float n2 = fract(sin(dot(seed + vec2(1.0, 1.0), vec2(12.9898, 78.233))) * 43758.5453);
  return (n + n2 - 1.0);
}

void main() {
  vec2 uv = vUv;
  vec2 centeredUv = uv - 0.5;

  // 1. Subtle radial chromatic aberration
  vec2 caOffset = centeredUv * uChromaticAberration;
  float r = texture2D(tDiffuse, uv + caOffset).r;
  float g = texture2D(tDiffuse, uv).g;
  float b = texture2D(tDiffuse, uv - caOffset).b;
  vec3 color = vec3(r, g, b);

  // 2. Cinematic Vignette (smooth quadratic darkening towards edges)
  float distFromCenter = length(centeredUv);
  float vignette = smoothstep(uVignetteRadius, uVignetteRadius - 0.45, distFromCenter);
  vignette = mix(1.0, vignette, uVignetteStrength);
  color *= vignette;

  // 3. Contrast adjustment (S-curve centered on middle gray 0.18 in linear space)
  color = clamp(color, 0.0, 10.0);
  color = pow(color, vec3(uContrast));

  // 4. Saturation adjustment
  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = mix(vec3(luma), color, uSaturation);

  // 5. Film grain & triangular dither (eliminates banding in nocturnal fog)
  float grain = ditherTriangular(uv, uTime) * uGrainIntensity;
  color += vec3(grain);

  gl_FragColor = vec4(max(color, vec3(0.0)), 1.0);
}
