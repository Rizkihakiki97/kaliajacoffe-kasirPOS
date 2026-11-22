import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Saat development, Vite meneruskan /api dan /uploads ke backend Golang
// di localhost:8080. Cookie HttpOnly tetap ikut karena proxy satu-origin.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8080',
      '/uploads': 'http://127.0.0.1:8080',
    },
  },
  preview: {
    proxy: {
      '/api': 'http://127.0.0.1:8080',
      '/uploads': 'http://127.0.0.1:8080',
    },
  },
});
