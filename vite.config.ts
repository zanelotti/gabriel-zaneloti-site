import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        // Ferramenta interna (uso do Gabriel) — não linkada no site público, sem indexação.
        calculo: path.resolve(__dirname, 'calculo.html'),
        crm: path.resolve(__dirname, 'crm.html'),
        privacidade: path.resolve(__dirname, 'privacidade.html'),
        termos: path.resolve(__dirname, 'termos.html'),
        sobre: path.resolve(__dirname, 'sobre.html'),
      },
    },
  },
});
