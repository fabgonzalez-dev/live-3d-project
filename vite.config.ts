import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        // Two entry points: display and control
        main: resolve(__dirname, 'index.html'),
        control: resolve(__dirname, 'control.html'),
      },
    },
  },
  server: {
    port: 5173,
    // Proxy WebSocket and API calls to local Express server
    proxy: {
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
        rewrite: (path) => path,
      },
      '/api': {
        target: 'http://localhost:3001',
        rewrite: (path) => path,
      },
    },
  },
});
