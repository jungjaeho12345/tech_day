// Browser entry point. The real HTTP/SSE-backed Model is wired here: login compares against the DB
// USER table, and 송고/보류/KILL persist through the Express backend (base http://127.0.0.1:3001,
// overridable via VITE_API_BASE).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/yonhap.css';
import { App } from './app/App.jsx';
import { createHttpModel } from './model/httpModel.js';

// The injectable Model keeps the View/Controller layers transport-agnostic; the REST/SSE wiring
// lives entirely behind this contract (web/src/model/contract.js).
const model = createHttpModel();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App model={model} />
  </StrictMode>,
);
