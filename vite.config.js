import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';

// Relative base keeps the build working under a GitHub Pages repository path.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 700, // three.js alone is ~600 kB
    // Libraries in their own chunks, so a site update leaves them cached.
    rolldownOptions: {output: {codeSplitting: {groups: [
      {name: 'three', test: /node_modules[\\/]three[\\/]/},
      {name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/},
    ]}}},
  },
});
