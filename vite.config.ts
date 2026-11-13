/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Diagnostic builds (`vite build --mode diag`): force NODE_ENV to
// "development" so every React-family package in the bundle (react,
// react-dom, AND the react-reconciler copy used by react-konva) takes
// its development branch — runtime errors then carry full messages and
// component names instead of minified production codes such as
// "Minified React error #185". Used to root-cause the v1.5.5 crash;
// normal releases build without the diag mode and are unaffected.
export default defineConfig(({ mode }) => {
  const diag = mode === 'diag';

  return {
    plugins: [react()],

    define: {
      __OSA_DIAG__: JSON.stringify(diag),
      ...(diag ? { 'process.env.NODE_ENV': '"development"' } : {}),
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },

    test: {
      passWithNoTests: true,
    },

    // Prevent vite from obscuring Rust errors
    clearScreen: false,

    // Tauri expects a fixed port, fail if that port is not available
    server: {
      port: 1420,
      strictPort: true,
      watch: {
        // Tell vite to ignore watching `src-tauri`
        ignored: ['**/src-tauri/**'],
      },
    },

    // Env variables starting with TAURI_ are passed to tauri
    envPrefix: ['VITE_', 'TAURI_ENV_*'],

    build: {
      // Tauri uses Chromium on Windows and WebKit on macOS/Linux
      target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari14',
      // Don't minify for debug builds
      minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
      // Produce sourcemaps for debug builds
      sourcemap: !!process.env.TAURI_ENV_DEBUG,
    },
  };
});
