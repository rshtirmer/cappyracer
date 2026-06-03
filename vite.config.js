import { defineConfig } from 'vite';

// `base` is set only for production builds so the bundle works when served from
// the GitHub Pages subpath (https://rshtirmer.github.io/cappyracer/). Local dev
// (`npm run dev`) stays at the root so nothing about the workflow changes.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/cappyracer/' : '/',
  server: {
    port: 3000,
  },
  build: {
    target: 'esnext',
  },
}));
