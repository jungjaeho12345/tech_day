import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite build config for the frontend (SPEC-FRONTEND-UI-001).
export default defineConfig({
  plugins: [react()],
});
