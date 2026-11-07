/**
 * shaders/tunnelVertex.glsl
 * Living Crystalline Vortex Cavern Geode vertex shader (TARGET_07–08 / improvements.md §9).
 *
 * Implements:
 * - Macro crystalline geode chamber expansion / breathing
 * - Faceted crystal ridges and angular stepped displacement
 * - Seamless longitudinal coordinate streaming
 * - Continuous axial twist
 * - Screen-space facet preparation for dFdx/dFdy
 */

precision highp float;

uniform float uTime;
uniform float uTravelOffset;
uniform float uDisplacementAmp;
uniform float uTwistAmount;
uniform float uPatternScale;

varying vec2  vUv;
varying vec3  vWorldPos;
varying vec3  vNormal;
varying float vDisplacement;
varying float vDepth;
varying float vRadius;

// ── Simplex Noise 3D ──────────────────────────────────────────
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

void main() {
  vec2 texCoord = uv;

  // Seamless continuous forward motion along tunnel length
  float continuousZ = position.z + uTravelOffset * 40.0;

  // Macro crystalline chamber breathing (Section 9.3)
  float chamberBreathing = sin(position.z * 0.06 - uTime * 0.4) * 0.18;

  // Twist rotation angle as a function of depth
  float depthRatio = clamp(-position.z / 95.0, 0.0, 1.0);
  float angle = depthRatio * uTwistAmount;
  float cosA = cos(angle), sinA = sin(angle);

  // Seamless multi-octave 3D noise for crystalline displacement
  vec3 noiseCoord = vec3(
    position.xy * (uPatternScale * 0.32),
    continuousZ * (uPatternScale * 0.14) + uTime * 0.06
  );
  float n1 = snoise(noiseCoord);
  float n2 = snoise(noiseCoord * 2.4 + vec3(4.1, 1.5, 0.9));

  // Angular crystalline facet quantization (stepped ridges)
  float rawDisp = n1 * 0.65 + n2 * 0.35 + chamberBreathing;
  float crystalSteps = 7.0;
  float facetedDisp = floor(rawDisp * crystalSteps) / crystalSteps;
  float disp = mix(rawDisp, facetedDisp, 0.45) * uDisplacementAmp;

  vDisplacement = disp;

  // Displace along surface normal
  vec3 displaced = position + normal * disp;

  // Apply twist rotation in XY plane around Z axis
  float origX = displaced.x, origY = displaced.y;
  displaced.x = origX * cosA - origY * sinA;
  displaced.y = origX * sinA + origY * cosA;

  vRadius = length(displaced.xy);

  vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
  vWorldPos  = worldPos.xyz;
  vNormal    = normalMatrix * normal;
  vUv        = texCoord;

  // Depth along camera view axis
  vec4 viewPos = viewMatrix * worldPos;
  vDepth = clamp(-viewPos.z / 85.0, 0.0, 1.0);

  gl_Position = projectionMatrix * viewPos;
}
