import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'path';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        redirect: resolve(__dirname, 'src/redirect/index.html'),
        options: resolve(__dirname, 'src/options/index.html'),
      },
    },
  },
});
