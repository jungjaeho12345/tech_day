import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Frontend test config (SPEC-FRONTEND-UI-001). Scoped to web/ so the backend
// node:test runner and this Vitest runner never execute each other's files.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/model/**', 'src/controller/**', 'src/view/**', 'src/app/**'],
      exclude: ['src/test/**', 'src/main.jsx', '**/*.test.{js,jsx}'],
    },
  },
});
