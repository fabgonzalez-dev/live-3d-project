/**
 * shaders/common/fresnel.glsl
 * Fresnel rim lighting, Schlick approximations, and thin-film iridescence for crystals and portals.
 */

// Basic Fresnel rim term: returns 0.0 when facing the camera, 1.0 at grazing angles
float fresnelTerm(vec3 normal, vec3 viewDir, float power) {
  float nDotV = clamp(dot(normalize(normal), normalize(viewDir)), 0.0, 1.0);
  return pow(1.0 - nDotV, power);
}

// Schlick Fresnel approximation with base reflectance F0
vec3 fresnelSchlick(float cosTheta, vec3 F0) {
  return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

// Procedural thin-film iridescence / prismatic color shift
// Maps grazing angle to rainbow spectrum [0, 1]
vec3 iridescenceColor(float cosTheta, float frequency, float phase) {
  float t = cosTheta * frequency + phase;
  // Cosine palette spectrum
  return 0.5 + 0.5 * cos(6.28318 * (vec3(1.0, 0.67, 0.33) + t));
}
