/**
 * shaders/common/sdf.glsl
 * Signed Distance Functions (SDFs) for procedural masks, portals, and glyph shapes.
 */

// 2D Circle SDF
float sdfCircle(vec2 p, float r) {
  return length(p) - r;
}

// 2D Annulus / Ring SDF
float sdfRing(vec2 p, float r, float thickness) {
  return abs(length(p) - r) - thickness * 0.5;
}

// 2D Box SDF
float sdfBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

// 2D Regular Hexagon SDF
float sdfHexagon(vec2 p, float r) {
  const vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
  p = abs(p);
  p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
  return length(p) * sign(p.y);
}

// Smooth union of two SDF distances
float opSmoothUnion(float d1, float d2, float k) {
  float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
  return mix(d2, d1, h) - k * h * (1.0 - h);
}
