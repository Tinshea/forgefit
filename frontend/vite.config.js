import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // En dev, /api est relaye vers le conteneur API : le navigateur ne
    // voit qu'une seule origine, donc pas de preflight CORS.
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
