/**
 * shaders/auroraFragment.glsl
 * Upgraded GPU-driven Aurora Borealis fragment shader.
 *
 * Implements:
 * - Domain-warped magnetic field line filaments flowing organically
 * - Spectral three-tier color gradient (emerald base -> cyan mid -> violet/magenta crown)
 * - Volumetric optical thickness approximation (fold glow)
 * - Soft atmospheric dissipation at base, crown, and lateral edges
 */

precision highp float;

uniform float uTime;
uniform vec3  uColorBase;    // Bottom curtain color (emerald / cyan oxygen emission)
uniform vec3  uColorMid;     // Mid curtain color (teal / violet)
uniform vec3  uColorTop;     // Crown color (magenta / deep indigo high-altitude emission)
uniform float uIntensity;

varying vec2  vUv;
varying vec3  vWorldPos;
varying float vHeight;
varying float vCurtain;

// Fast permutation hash
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 10.0) * x); }

float snoise2D(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// 2-octave FBM for light filaments
float fbmRay(vec2 p) {
  float v = snoise2D(p) * 0.65;
  v += snoise2D(p * 2.15 + vec2(1.7, 9.2)) * 0.35;
  return v;
}

void main() {
  vec2 uv = vUv;

  // 1. Domain-warping for fluid light curtain rays
  float timeOffset = uTime * 0.22 + vCurtain * 1.47;
  vec2 warpQ = vec2(
    snoise2D(vec2(uv.x * 6.0 + timeOffset * 0.15, uv.y * 1.5)),
    snoise2D(vec2(uv.x * 6.0 - timeOffset * 0.10, uv.y * 2.0))
  );

  // Vertical magnetic ray filaments warped across UV space
  float rayCoord = uv.x * 32.0 + warpQ.x * 2.5 + vCurtain * 7.3;
  float primaryRays = sin(rayCoord + timeOffset * 0.6) * 0.35 +
                      sin(rayCoord * 2.3 - timeOffset * 0.4) * 0.25 + 0.5;

  // Fine filament detail
  float fineRay = fbmRay(vec2(uv.x * 65.0 + warpQ.y * 3.0, uv.y * 4.0 - timeOffset * 0.3)) * 0.35 + 0.65;
  float filament = clamp(primaryRays * fineRay, 0.0, 1.5);

  // 2. Vertical profile: soft fade at base, peak in lower-mid, soft ethereal fade into space
  float bottomFade = smoothstep(0.01, 0.15, vHeight);
  float topFade    = 1.0 - smoothstep(0.48, 0.98, vHeight);
  float verticalProfile = bottomFade * topFade;

  // Horizontal edge falloff to avoid harsh cutoffs at curtain boundaries
  float horizFade = smoothstep(0.0, 0.10, uv.x) * (1.0 - smoothstep(0.90, 1.0, uv.x));

  // 3. Multi-spectral vertical color gradient
  vec3 gradColor;
  if (vHeight < 0.38) {
    float t = smoothstep(0.0, 0.38, vHeight);
    gradColor = mix(uColorBase, uColorMid, t);
  } else {
    float t = smoothstep(0.38, 0.95, vHeight);
    gradColor = mix(uColorMid, uColorTop, t);
  }

  // 4. Volumetric fold glow (simulates optical thickness along curved folds)
  float foldGlow = pow(filament, 1.6) * 1.8;

  // 5. Final alpha & composition
  float alpha = verticalProfile * horizFade * (0.28 + foldGlow * 0.72) * uIntensity;
  if (alpha < 0.004) discard;

  // Boost emissive color at luminous filament folds
  vec3 finalColor = gradColor * alpha * (1.4 + foldGlow * 0.6);

  gl_FragColor = vec4(finalColor, alpha);
}
