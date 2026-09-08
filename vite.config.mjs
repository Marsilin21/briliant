import { defineConfig } from 'vite';
export default defineConfig({
  root: 'admin', base: '/admin/',
  build: { outDir: '../dist/admin', emptyOutDir: true },
  server: { port: 4181, proxy: { '/api': 'http://127.0.0.1:4180' } }
});
