import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/d3-world-map/' : '/',
  build: {
    outDir: 'dist'
  },
  preview: {
    port: 4173
  },
  optimizeDeps: {
    include: ['d3', 'topojson']
  }
});
