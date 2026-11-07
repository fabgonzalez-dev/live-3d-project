/**
 * shaders/auroraVertex.glsl
 * Upgraded GPU-driven Aurora Borealis ribbon vertex shader.
 *
 * Implements organic multi-curtain wave propagation:
 * - Layer-dependent harmonic phase velocity
 * - Height-attenuated amplitude (folds widen toward celestial crown)
 * - Simplex-noise-driven organic turbulence for non-repeating folds
 */

precision highp float;

uniform float uTime;
uniform float uWaveSpeed;
uniform float uWaveAmp;

attribute float aCurtainIndex; // 0..4 for distinct celestial curtain layers

varying vec2  vUv;
varying vec3  vWorldPos;
varying float vHeight;        // 0.0 at base, 1.0 at upper crown
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

void main() {
  vUv = uv;
  vHeight = uv.y;
  vCurtain = aCurtainIndex;

  vec3 pos = position;

  // Layer-dependent phase velocity
  float layerPhase = aCurtainIndex * 1.83 + uTime * uWaveSpeed * (0.85 + aCurtainIndex * 0.15);

  // Multi-frequency harmonic wave propagation
  float w1 = sin(pos.x * 0.12 + layerPhase) * 2.8;
  float w2 = sin(pos.x * 0.28 - layerPhase * 0.72) * 1.4;
  float w3 = cos(pos.x * 0.55 + layerPhase * 1.35) * 0.7;

  // Organic simplex noise turbulence along curtain length
  float noiseDisplace = snoise2D(vec2(pos.x * 0.06 + layerPhase * 0.25, aCurtainIndex * 3.7)) * 2.2;

  // Folds expand in amplitude smoothly from base to crown
  float foldAmp = smoothstep(0.05, 0.75, uv.y) * uWaveAmp;
  pos.z += (w1 + w2 + w3 + noiseDisplace) * foldAmp;

  // Gentle vertical wave lift
  pos.y += sin(pos.x * 0.15 + layerPhase * 0.5) * 0.8 * foldAmp;

  // Subtle lateral drift
  pos.x += cos(pos.y * 0.20 + uTime * 0.12) * 0.6;

  vec4 worldPos = modelMatrix * vec4(pos, 1.0);
  vWorldPos = worldPos.xyz;

  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
