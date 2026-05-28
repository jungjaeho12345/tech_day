import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev-server fallback so deep-links / reloads of the .do SPA routes (login.do / writer.do / list.do)
// serve index.html instead of 404ing. Vite's history-fallback only matches extensionless paths, and
// '.do' looks like a file extension to it — so we rewrite the known .do paths to '/' before Vite's
// transform middleware runs. Dev-only (configureServer); production hosting needs its own rewrite.
function doFallback() {
  return {
    name: 'yh-do-fallback',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && /^\/(login|writer|list)\.do(\?|$)/.test(req.url)) {
          req.url = '/';
        }
        next();
      });
    },
  };
}

// Vite build config for the frontend (SPEC-FRONTEND-UI-001).
export default defineConfig({
  plugins: [react(), doFallback()],
});
