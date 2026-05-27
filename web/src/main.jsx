// Browser entry point. The real (HTTP/WebSocket-backed) Model is wired here at the Run stage;
// for now an in-memory placeholder Model satisfies the contract so the app boots.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App.jsx';
import { createFakeModel } from './test/fakeModel.js';

// NOTE: concrete REST/search-proxy/realtime transports are Run-stage (SPEC Exclusions).
// The injectable Model lets that wiring change without touching the View/Controller layers.
const model = createFakeModel();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App model={model} />
  </StrictMode>,
);
