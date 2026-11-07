/**
 * shaders/cityFragment.glsl
 * Hyperdimensional Sci-Fi Architectural Tunnel Hull fragment shader.
 *
 * Implements:
 * - Geometric screen-space faceted normals (dFdx/dFdy) for crisp structural bevels
 * - Deep obsidian metallic hull shading (#04060b) with dark titanium paneling
 * - Longitudinal glowing conduit bus-lines with traveling pulse energy
 * - Multi-directional specular highlights catching metallic faceted seams
 * - Deep negative-black vanishing point corridor to preserve scale and contrast (Section 8.4)
 * - Jewel-tone selective bloom highlights (electric cyan, hot magenta, warm amber)
 */

precision highp float;

uniform float uTime;
uniform float uTravelOffset;
uniform float uEmissiveIntensity;
uniform float uHighlightSharpness;

// Palette uniforms
uniform vec3 uWallBase;
uniform vec3 uWallEmissive;
uniform vec3 uHighlight;
uniform vec3 uFogNear;
uniform vec3 uFogFar;

varying vec3  vWorldPos;
varying vec2  vUv;
varying float vRadius;
varying float vDepth;

// 2D pseudo-random hash
float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

void main() {
  // Screen-space flat architectural facet normals
  vec3 dpdx = dFdx(vWorldPos);
  vec3 dpdy = dFdy(vWorldPos);
  vec3 N = normalize(cross(dpdx, dpdy));
  vec3 V = normalize(cameraPosition - vWorldPos);
  if (dot(N, V) < 0.0) N = -N;

  // Polar coordinates along tunnel cylinder
  float rDist = length(vWorldPos.xy);
  float theta = atan(vWorldPos.y, vWorldPos.x);

  // ── 1. 12-Sided Faceted Structural Hull Geometry ─────────────
  float sectors = 12.0;
  float sectorAngle = 6.2831853 / sectors;
  float sectorIdx = floor((theta + 3.14159265) / sectorAngle);
  float sectorFrac = mod(theta + 3.14159265, sectorAngle) / sectorAngle;
  float panelDistToSeam = min(sectorFrac, 1.0 - sectorFrac);

  // Longitudinal structural seam lines between faceted plates
  float seamMask = smoothstep(0.04, 0.01, panelDistToSeam);

  // ── 2. Multi-Directional Specular Glints ──────────────────────
  vec3 L1 = normalize(vec3(0.5, 0.8, 0.5));
  vec3 L2 = normalize(vec3(-0.7, -0.4, 0.6));
  vec3 L3 = normalize(vec3(0.1, -0.9, 0.7));

  vec3 H1 = normalize(L1 + V);
  vec3 H2 = normalize(L2 + V);
  vec3 H3 = normalize(L3 + V);

  float s1 = pow(max(dot(N, H1), 0.0), uHighlightSharpness);
  float s2 = pow(max(dot(N, H2), 0.0), uHighlightSharpness * 1.4);
  float s3 = pow(max(dot(N, H3), 0.0), uHighlightSharpness * 2.0);
  float totalSpec = s1 * 0.85 + s2 * 0.65 + s3 * 0.9;

  // ── 3. Procedural Circuit Bus-lines & Neon Conduits ───────────
  // Longitudinal coordinate advancing with travel offset
  float zCoord = -vWorldPos.z * 0.4 + uTravelOffset * 18.0;
  vec2 busGrid = vec2(sectorIdx + sectorFrac, zCoord);

  // Primary power conduits (placed at seam boundaries)
  float conduitWidth = 0.035;
  float conduitLine = smoothstep(conduitWidth, 0.005, panelDistToSeam);

  // Periodic traveling pulse packet along conduits
  float pulseWave = sin(-vWorldPos.z * 0.35 - uTime * 4.5 + sectorIdx * 1.57);
  float pulseSpark = pow(max(pulseWave, 0.0), 8.0);

  // Secondary transverse circuit ribs (spaced every ~4 units along Z)
  float zRibFrac = fract(zCoord * 0.5);
  float zRibDist = min(zRibFrac, 1.0 - zRibFrac);
  float zRibLine = smoothstep(0.025, 0.005, zRibDist);

  // Micro data panel windows on alternating hull facets
  vec2 dataCell = floor(vec2(sectorFrac * 6.0, zCoord * 2.0));
  vec2 dataFrac = fract(vec2(sectorFrac * 6.0, zCoord * 2.0));
  float cellRand = hash21(dataCell + sectorIdx * 31.0);
  float dataLit = step(0.72, cellRand);
  float dataMask = step(0.25, dataFrac.x) * step(dataFrac.x, 0.75) *
                   step(0.25, dataFrac.y) * step(dataFrac.y, 0.75);

  // ── 4. Deep Obsidian Metal Base Material ──────────────────────
  // High contrast: deep negative black (#030509) to dark titanium (#182030)
  vec3 obsidianBase = vec3(0.02, 0.03, 0.05);
  vec3 titaniumPanel = mix(obsidianBase, uWallBase * 0.35, 0.4 + panelDistToSeam * 0.6);
  vec3 baseColor = mix(titaniumPanel, obsidianBase * 0.4, seamMask * 0.75);

  // ── 5. Emissive Lighting Composition ─────────────────────────
  // Primary conduit glow: jewel-tone emissive with white-hot core
  vec3 conduitColor = mix(uWallEmissive * 1.8, vec3(1.0), pulseSpark * 0.65);
  vec3 conduitEmissive = conduitColor * conduitLine * (0.85 + pulseSpark * 1.8);

  // Transverse ring rib accent glow
  vec3 ribColor = uHighlight * 1.5;
  vec3 ribEmissive = ribColor * zRibLine * 0.6;

  // Data indicator panels
  vec3 dataColor = mix(uHighlight, uWallEmissive, cellRand);
  vec3 dataEmissive = dataColor * dataLit * dataMask * 1.2;

  // Architectural Fresnel rim reflection
  float NdotV = max(dot(N, V), 0.0);
  float fresnel = pow(1.0 - NdotV, 3.5);
  vec3 rimGlow = uHighlight * fresnel * 0.5;

  // Combine hull color components
  vec3 finalColor = baseColor + (conduitEmissive + ribEmissive + dataEmissive) * uEmissiveIntensity;
  finalColor += rimGlow;
  finalColor += (uHighlight * 0.8 + vec3(0.2)) * totalSpec * 1.2;

  // ── 6. Central Corridor Void & Vanishing Point Darkening ──────
  // Emphasize scale by keeping the inner flight space dark & uncluttered (Section 8.4)
  float corridorMask = smoothstep(1.8, 4.5, rDist);
  finalColor *= corridorMask;

  // ── 7. Atmospheric Depth Fog to Deep Space Void ──────────────
  float fogFactor = clamp((-vWorldPos.z - 8.0) / 75.0, 0.0, 1.0);
  finalColor = mix(finalColor, uFogFar, fogFactor * 0.98);

  gl_FragColor = vec4(finalColor, 1.0);
}
