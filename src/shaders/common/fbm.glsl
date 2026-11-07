/**
 * shaders/common/fbm.glsl
 * Multi-octave Fractional Brownian Motion (FBM) layered on 2D and 3D Simplex noise.
 * Requires simplexNoise.glsl to be included before this chunk.
 */

// 2D FBM with 4 octaves
float fbm2D(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  // Rotation matrix per octave to break axis-aligned grid artifacts
  mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));

  for (int i = 0; i < 4; i++) {
    value += amplitude * simplex2D(p * frequency);
    p = rot * p * 2.0;
    amplitude *= 0.5;
  }
  return value;
}

// 2D FBM with configurable 6 octaves for detailed atmospheric mist
float fbm2D_Detailed(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);

  for (int i = 0; i < 6; i++) {
    value += amplitude * simplex2D(p);
    p = rot * p * 2.05;
    amplitude *= 0.48;
  }
  return value;
}

// 3D FBM with 4 octaves
float fbm3D(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;

  for (int i = 0; i < 4; i++) {
    value += amplitude * simplex3D(p * frequency);
    frequency *= 2.02;
    amplitude *= 0.5;
  }
  return value;
}

// Ridge noise (absolute value inverted for sharp crystalline / mountain ridges)
float ridgeNoise2D(vec2 p) {
  float n = abs(simplex2D(p));
  return 1.0 - n;
}

float ridgeFbm2D(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  float weight = 1.0;

  for (int i = 0; i < 4; i++) {
    float n = 1.0 - abs(simplex2D(p * frequency));
    n *= n;
    n *= weight;
    weight = clamp(n * 2.0, 0.0, 1.0);
    value += n * amplitude;
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}
