/**
 * shaders/tunnelFragment.glsl
 * Living Crystalline Vortex Cavern Geode fragment shader (TARGET_07–08 / improvements.md §9).
 *
 * Implements:
 * - Geometric flat screen-space facet normals (dFdx/dFdy)
 * - Internal refraction caustics approximation (double-bounce light penetration)
 * - Chromatic iridescence / spectral dispersion on facet seams
 * - Procedural Voronoi crystalline cellular veins and quartz banding
 * - Multi-directional specular glints across faceted crystal faces
 * - Deep pitch-black central vanishing point void
 */

precision highp float;

uniform float uTime;
uniform float uTravelOffset;
uniform float uFlowSpeed;
uniform float uHighlightSharpness;
uniform float uEmissiveIntensity;

// Palette uniforms
uniform vec3 uWallBase;
uniform vec3 uWallEmissive;
uniform vec3 uHighlight;
uniform vec3 uFogNear;
uniform vec3 uFogFar;

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

// 2D cellular Voronoi for crystalline veins
float voronoi2D(vec2 p) {
  vec2 g = floor(p);
  vec2 f = fract(p);
  float minDist = 1.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 lattice = vec2(float(x), float(y));
      vec2 offset = fract(sin(vec2(dot(g + lattice, vec2(127.1, 311.7)),
                                   dot(g + lattice, vec2(269.5, 183.3)))) * 43758.5453);
      float d = length(lattice + offset - f);
      minDist = min(minDist, d);
    }
  }
  return minDist;
}

void main() {
  // Screen-space flat facet normals for crisp crystalline faces
  vec3 dpdx = dFdx(vWorldPos);
  vec3 dpdy = dFdy(vWorldPos);
  vec3 N = normalize(cross(dpdx, dpdy));
  vec3 V = normalize(cameraPosition - vWorldPos);
  if (dot(N, V) < 0.0) N = -N;

  // Polar angle for hue variations
  float theta = atan(vWorldPos.y, vWorldPos.x);

  // ── 1. Crystalline Natural Rock Strata & Quartz Veins ────────
  vec3 rockCoord = vec3(vWorldPos.xy * 0.45, -vWorldPos.z * 0.08 + uTravelOffset * 2.0);
  float rockNoise1 = snoise(rockCoord);
  float rockNoise2 = snoise(rockCoord * 2.8 + vec3(1.7, 3.2, 0.5));
  float strata = sin(vWorldPos.y * 1.8 + rockNoise1 * 1.4) * 0.5 + 0.5;

  vec2 veinCoord = vec2(vWorldPos.y * 0.6 + theta * 1.8, -vWorldPos.z * 0.12 + uTravelOffset * 3.0);
  float vCell = voronoi2D(veinCoord);
  float crystalRidge = smoothstep(0.09, 0.01, vCell) * (rockNoise2 * 0.5 + 0.5);

  // ── 2. Multi-Directional Specular Glints with Dispersion ─────
  vec3 L1 = normalize(vec3(0.5, 0.8, 0.5));
  vec3 L2 = normalize(vec3(-0.7, -0.3, 0.6));
  vec3 L3 = normalize(vec3(0.2, -0.9, 0.7));

  vec3 H1 = normalize(L1 + V);
  vec3 H2 = normalize(L2 + V);
  vec3 H3 = normalize(L3 + V);

  float s1 = pow(max(dot(N, H1), 0.0), uHighlightSharpness);
  float s2 = pow(max(dot(N, H2), 0.0), uHighlightSharpness * 1.5);
  float s3 = pow(max(dot(N, H3), 0.0), uHighlightSharpness * 2.5);
  float totalSpec = s1 * 0.85 + s2 * 0.55 + s3 * 0.65;

  // Chromatic dispersion (spectral wavelength splitting on edges)
  vec3 specColor = vec3(
    pow(max(dot(N, normalize(H1 + vec3(0.04, 0.0, 0.0))), 0.0), uHighlightSharpness),
    totalSpec,
    pow(max(dot(N, normalize(H1 - vec3(0.04, 0.0, 0.0))), 0.0), uHighlightSharpness)
  );

  // ── 3. Internal Refraction Approximation (Caustic Depth) ─────
  vec3 R = refract(-V, N, 0.70);
  vec3 internalCoord = vWorldPos + R * 0.9;
  float internalNoise = snoise(internalCoord * 0.85 + vec3(0.0, 0.0, uTime * 0.2));
  float internalCaustic = pow(max(internalNoise * 0.7 + 0.3, 0.0), 4.5);

  // ── 4. Crystalline Fresnel Rim Glow ──────────────────────────
  float NdotV = max(dot(N, V), 0.0);
  float fresnel = pow(1.0 - NdotV, 3.2);

  // ── 5. Base Geode Wall Color & Emissive Inclusions ───────────
  // Deep charcoal-indigo slate rock with rich purple mineral undertones
  vec3 matrixBase = vec3(0.024, 0.018, 0.038);
  vec3 rockTint = mix(matrixBase, uWallBase * 0.85, strata * 0.55);
  vec3 geodeWall = mix(rockTint, uWallEmissive * 0.4, crystalRidge * 0.5);

  // Emissive crystalline veins & interior caustics (crisp, localized highlights)
  vec3 veinEmissive = uWallEmissive * crystalRidge * 1.6;
  vec3 causticEmissive = uHighlight * internalCaustic * 1.2;
  vec3 totalEmissive = (veinEmissive + causticEmissive) * uEmissiveIntensity;

  // Diffuse response across crystal facets
  float diff = max(dot(N, L1), 0.0) * 0.75 + max(dot(N, L2), 0.0) * 0.35;
  float ambient = 0.14; // Visible ambient so rock cavern feels spatial & majestic

  // Combine surface lighting components
  vec3 finalColor = geodeWall * (ambient + diff) + totalEmissive;
  finalColor += mix(uHighlight, specColor, 0.5) * totalSpec * 1.2;
  finalColor += uWallEmissive * fresnel * 0.45;

  // ── 6. Central Cavern Path Lighting ──────────────────────────
  float distToCenter = length(vWorldPos.xy);
  float centerVoid = smoothstep(0.4, 3.6, distToCenter);
  finalColor *= mix(0.15, 1.0, centerVoid);

  // ── 7. Atmospheric Depth Fog to Deep Cavern Glow ─────────────
  float fogAmt = smoothstep(0.28, 0.96, vDepth);
  finalColor = mix(finalColor, uFogFar, fogAmt * 0.90);

  gl_FragColor = vec4(finalColor, 1.0);
}
