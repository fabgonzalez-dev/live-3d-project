/**
 * shaders/common/voronoi.glsl
 * Cellular / Voronoi / Worley noise for crystalline facet generation and organic fractures.
 */

// 2D Hash function returning pseudo-random vec2 in range [0, 1]
vec2 voronoiHash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453123);
}

// 2D Voronoi returning:
// x: closest distance (F1)
// y: second closest distance (F2)
// z: cell id / color hash
vec3 voronoi2D(vec2 p) {
  vec2 n = floor(p);
  vec2 f = fract(p);

  float m1 = 8.0;
  float m2 = 8.0;
  vec2 id = vec2(0.0);

  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = voronoiHash2(n + g);
      // Optional subtle animation can be added: o = 0.5 + 0.5 * sin(time + 6.2831 * o);
      vec2 r = g + o - f;
      float d = dot(r, r);

      if (d < m1) {
        m2 = m1;
        m1 = d;
        id = n + g;
      } else if (d < m2) {
        m2 = d;
      }
    }
  }

  return vec3(sqrt(m1), sqrt(m2), fract(sin(dot(id, vec2(12.9898, 78.233))) * 43758.5453));
}

// Crystal facet edge distance: returns F2 - F1 (sharp ridge at cell boundaries)
float voronoiBorder2D(vec2 p) {
  vec3 v = voronoi2D(p);
  return v.y - v.x;
}
