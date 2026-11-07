/**
 * shaders/common/lighting.glsl
 * Lighting utilities, procedural edge glow, and gradient ramps.
 */

// Cosine gradient color palette generator
// color = a + b * cos(2 * pi * (c * t + d))
vec3 cosinePalette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(6.28318 * (c * t + d));
}

// Procedural edge glow: gives emissive outline along geometric ridges or UV seams
float edgeGlow(float uvDist, float edgeWidth, float falloff) {
  return pow(smoothstep(0.0, edgeWidth, uvDist) * smoothstep(1.0, 1.0 - edgeWidth, uvDist), falloff);
}

// Triangular high-frequency dither (eliminates 8-bit color banding in WebGL)
float triangularDither(vec2 uv) {
  // Pseudo-random screen hash
  vec2 seed = uv + fract(vec2(1.234, 5.678));
  float noise = fract(sin(dot(seed, vec2(12.9898, 78.233))) * 43758.5453);
  return (noise - 0.5) / 255.0;
}
