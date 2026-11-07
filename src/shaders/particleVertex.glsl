/**
 * shaders/particleVertex.glsl
 * Particle system vertex shader.
 * Points are distributed along tunnel walls and mid-air layers.
 * Continuous GPU-side recycling along Z axis — no CPU attribute updates per frame.
 * Perspective size attenuation with near/far depth fading.
 */

precision highp float;

attribute float aSize;         // base point size
attribute float aPhase;        // 0..2π individual animation phase
attribute float aBrightness;   // 0..1
attribute float aLayer;        // 0=foreground, 1=mid, 2=wall-adjacent
attribute vec3  aDrift;        // slow drift velocity (per-particle)

uniform float uTime;
uniform float uPointSizeMax;   // hardware point size limit

varying float vBrightness;
varying float vPhase;
varying float vLayer;
varying float vAlpha;

void main() {
  // Continuous GPU wrapping along Z axis
  float zSpan = 65.0;
  float zMin = -65.0;
  float zPos = mod((position.z - zMin) + (aDrift.z * 10.0 * uTime), zSpan) + zMin;

  // Slight organic drift in XY
  vec2 xyPos = position.xy + aDrift.xy * sin(uTime * 0.5 + aPhase);
  vec3 pos = vec3(xyPos, zPos);

  // Shimmer modulation
  float shimmer = sin(uTime * 2.4 + aPhase * 6.2831853) * 0.5 + 0.5;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  float dist = -mvPosition.z;

  // Perspective size — crisp pinpricks and star glints, never giant blurry discs
  float size = aSize * (1.0 + shimmer * 0.4) * (80.0 / max(dist, 1.0));
  size = clamp(size, 1.0, min(uPointSizeMax, 18.0));

  // Near and far fade so particles don't clip lens or crowd the vanishing point
  float nearFade = smoothstep(1.5, 3.5, dist);
  float farFade  = 1.0 - smoothstep(30.0, 62.0, dist);
  vAlpha = nearFade * farFade * aBrightness;

  vBrightness = aBrightness;
  vPhase      = aPhase;
  vLayer      = aLayer;

  gl_PointSize = size;
  gl_Position  = projectionMatrix * mvPosition;
}
