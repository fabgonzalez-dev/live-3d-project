/**
 * shaders/common/domainWarp.glsl
 * Multi-layer domain warping for organic flowing patterns (aurora, mist, fluid crystals).
 * Requires simplexNoise.glsl and fbm.glsl.
 */

// Dual-layer domain warp: f(p + g(p + h(p)))
// Returns warped pattern value and populates intermediate warp vectors
float domainWarp2D(vec2 p, float time, out vec2 q, out vec2 r) {
  // First warp layer
  q = vec2(
    fbm2D(p + vec2(0.0, 0.0) + 0.10 * time),
    fbm2D(p + vec2(5.2, 1.3) + 0.12 * time)
  );

  // Second warp layer
  r = vec2(
    fbm2D(p + 4.0 * q + vec2(1.7, 9.2) + 0.15 * time),
    fbm2D(p + 4.0 * q + vec2(8.3, 2.8) + 0.13 * time)
  );

  // Final noise sample warped by r
  return fbm2D(p + 4.0 * r);
}

// Lightweight single-layer domain warp for high-performance rendering
float domainWarpFast2D(vec2 p, float time) {
  vec2 q = vec2(
    simplex2D(p + 0.08 * time),
    simplex2D(p + vec2(3.1, 1.7) - 0.06 * time)
  );
  return fbm2D(p + 1.8 * q);
}
