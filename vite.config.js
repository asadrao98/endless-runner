import { defineConfig } from 'vite';

// Minimal Vite config: relative base so the build works on any static host.
export default defineConfig({
  base: './',
  server: {
    open: true,
    host: true,
  },
  build: {
    target: 'es2020',
    sourcemap: false,
  },
});
