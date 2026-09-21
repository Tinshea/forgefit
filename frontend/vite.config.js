import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  // ┌─ PREACT A LA PLACE DE REACT ────────────────────────────────────┐
  // │ `preact/compat` expose la meme interface que React, pour un     │
  // │ tiers du poids : ~12 Ko compresses contre ~45. Sur un telephone │
  // │ d'entree de gamme, ce n'est pas le TELECHARGEMENT qui compte —  │
  // │ quelques dizaines de kilo-octets — mais l'ANALYSE ET            │
  // │ L'EXECUTION du script, qui se paient en centaines de            │
  // │ millisecondes de blocage.                                        │
  // │                                                                   │
  // │ La substitution n'est acceptable que VERIFIEE : `check:screens`  │
  // │ ouvre les quatorze ecrans dans un vrai navigateur et refuse     │
  // │ la moindre erreur console. C'est ce qui permet de l'assumer     │
  // │ malgre recharts, la bibliotheque la plus susceptible d'en       │
  // │ souffrir.                                                        │
  // └───────────────────────────────────────────────────────────────────┘
  resolve: {
    alias: {
      react: 'preact/compat',
      'react-dom': 'preact/compat',
      'react-dom/test-utils': 'preact/test-utils',
      'react/jsx-runtime': 'preact/jsx-runtime',
    },
  },
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
