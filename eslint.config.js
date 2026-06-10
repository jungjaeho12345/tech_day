import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

// Flat config covering both the Node backend (server/, test/, build configs)
// and the React 19 + Vite frontend (web/src/). No lint tooling existed before,
// so noisy stylistic rules are set to "warn" (non-blocking) and only genuine
// correctness issues (no-undef, rules-of-hooks) remain "error" so the
// pre-commit hook does not block on pre-existing code.
export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '.claude/**', // agent/tooling scripts, not application code
    ],
  },

  js.configs.recommended,

  // Backend (Node.js): MVC source (src/), server runtime, backend tests,
  // and root/web build configs.
  {
    files: [
      'src/**/*.js',
      'server/**/*.js',
      'test/**/*.js',
      '*.config.js',
      'web/*.config.js',
    ],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },

  // Frontend (React 19 + Vite, browser runtime).
  {
    files: ['web/src/**/*.{js,jsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      // Treat JSX-referenced identifiers as used so imported components
      // are not flagged by no-unused-vars.
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'off', // new JSX transform (React 17+)
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': 'warn',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },

  // Frontend test files (Vitest globals via `globals: true` in vitest.config.js).
  // Include node globals too: jsdom tests reach for `global`, `process`, etc.
  {
    files: ['web/src/**/*.test.{js,jsx}', 'web/src/test/**/*.{js,jsx}'],
    languageOptions: {
      globals: {
        ...globals.node,
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        suite: 'readonly',
      },
    },
  },
];
