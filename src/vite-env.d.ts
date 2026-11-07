/**
 * vite-env.d.ts
 * Type declarations for Vite-specific module features.
 */

/// <reference types="vite/client" />

// Allow importing GLSL files as raw strings via Vite's ?raw query
declare module '*.glsl?raw' {
  const src: string;
  export default src;
}

declare module '*.glsl' {
  const src: string;
  export default src;
}

// Allow importing shader files with raw suffix
declare module '*.vert?raw' {
  const src: string;
  export default src;
}

declare module '*.frag?raw' {
  const src: string;
  export default src;
}
