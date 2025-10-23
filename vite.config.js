import { defineConfig } from 'vite';

export default defineConfig({
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
