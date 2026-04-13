import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

const requestLogger = () => ({
  name: 'request-logger',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url.includes('wasm') || req.url.includes('clay')) {
        console.log('Request:', req.url);
      }
      next();
    });
  }
});

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(), 
      tailwindcss(), 
      wasm(), 
      topLevelAwait(), 
      requestLogger(),
      nodePolyfills({
        include: ['buffer', 'crypto', 'stream', 'util'],
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
