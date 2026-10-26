import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    watch: {
      ignored: ['**/legacy/**']
    }
  },
  optimizeDeps: {
    entries: ['index.html']
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 4000
  },
  worker: { format: 'es' }
});
