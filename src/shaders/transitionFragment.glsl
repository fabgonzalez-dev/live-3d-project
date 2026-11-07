/**
 * shaders/transitionFragment.glsl
 * Screen-space cross-environment transition shader (improvements.md §13).
 *
 * Implements:
 * - 1. Dimensional Portal Warp: Expanding circular vortex portal emerging from the vanishing point
 * - 2. Atmospheric Fog Dissolve: Volumetric mist blending with smooth luminance swell
 * - 3. Metamorphosis: Fluid chromatic dispersion and spatial energy seam
 */

precision highp float;

uniform sampler2D tDiffuseFrom;
uniform sampler2D tDiffuseTo;
uniform float     uProgress;     // 0.0 to 1.0
uniform float     uTime;
uniform vec2      uResolution;
uniform int       uTechnique;    // 0: portal_warp, 1: atmospheric_dissolve, 2: metamorphosis

varying vec2 vUv;

// Pseudo-random 2D noise
float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

void main() {
  vec2 uv = vUv;
  vec2 centered = (uv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);
  float dist = length(centered);
  float angle = atan(centered.y, centered.x);

  // Smooth S-curve progress
  float p = smoothstep(0.0, 1.0, uProgress);

  // Luminescence swell at midpoint (peaking at p = 0.5)
  float swell = sin(p * 3.14159265);
  float energyGlow = pow(swell, 2.5) * 0.45;

  vec4 colFrom;
  vec4 colTo;
  vec4 finalColor;

  if (uTechnique == 0) {
    // ── 1. Dimensional Portal Warp ───────────────────────────
    // Expanding circular iris with undulating energy boundary
    float portalWobble = sin(angle * 6.0 + uTime * 4.0) * 0.04 + sin(angle * 12.0 - uTime * 6.0) * 0.02;
    float portalRadius = p * 1.6; // Expands to cover full 16:9 / 9:16 screen

    float threshold = portalRadius + portalWobble;
    float edgeWidth = 0.08;
    float edgeMask = smoothstep(threshold - edgeWidth, threshold, dist);

    // Subtle radial chromatic aberration distortion around portal rim
    vec2 warpOffset = normalize(centered + 0.001) * swell * 0.035;
    colFrom = texture2D(tDiffuseFrom, uv + warpOffset * (1.0 - edgeMask));
    colTo   = texture2D(tDiffuseTo, uv - warpOffset * edgeMask);

    // Portal energy rim glow (cyan / violet / golden energy boundary)
    float rimGlow = smoothstep(0.0, edgeWidth * 0.5, abs(dist - threshold));
    rimGlow = (1.0 - rimGlow) * swell * 2.2;
    vec3 rimColor = mix(vec3(0.0, 0.94, 1.0), vec3(0.9, 0.4, 1.0), sin(angle * 2.0 + uTime * 3.0) * 0.5 + 0.5);

    finalColor = mix(colTo, colFrom, edgeMask);
    finalColor.rgb += rimColor * rimGlow;

  } else if (uTechnique == 1) {
    // ── 2. Atmospheric Fog Dissolve ──────────────────────────
    // Soft volumetric mist sweep
    float mistNoise = sin(uv.x * 8.0 + uTime * 1.5) * 0.05 + cos(uv.y * 6.0 - uTime * 1.2) * 0.05;
    float wipeP = smoothstep(p - 0.25, p + 0.25, uv.y + mistNoise);

    colFrom = texture2D(tDiffuseFrom, uv);
    colTo   = texture2D(tDiffuseTo, uv);

    // Ethereal light crossfade
    vec3 mistColor = vec3(0.7, 0.85, 1.0) * energyGlow;
    finalColor = mix(colTo, colFrom, wipeP);
    finalColor.rgb += mistColor;

  } else {
    // ── 3. Metamorphosis (Chromatic Dispersion Sweep) ────────
    vec2 dir = vec2(cos(uTime * 0.5), sin(uTime * 0.5)) * 0.025 * swell;
    float r = texture2D(tDiffuseFrom, uv + dir).r;
    float g = texture2D(tDiffuseFrom, uv).g;
    float b = texture2D(tDiffuseFrom, uv - dir).b;
    colFrom = vec4(r, g, b, 1.0);

    float rTo = texture2D(tDiffuseTo, uv - dir).r;
    float gTo = texture2D(tDiffuseTo, uv).g;
    float bTo = texture2D(tDiffuseTo, uv + dir).b;
    colTo = vec4(rTo, gTo, bTo, 1.0);

    finalColor = mix(colFrom, colTo, p);
    finalColor.rgb += vec3(0.5, 0.8, 1.0) * energyGlow;
  }

  gl_FragColor = finalColor;
}
