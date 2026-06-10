// Flat ESLint config (ESLint 9) for the article-production-system monorepo.
// Three file groups with distinct globals:
//   1. web/src/**     -> browser + React 19 + JSX (Vite frontend)
//   2. server/, src/  -> Node ESM backend (Express + node:sqlite)
//   3. **/*.test.*    -> test globals (vitest in web, node:test in backend)
// Rule strength is deliberately conservative: recommended baseline plus a few
// low-risk hygiene rules, tuned to avoid breaking the existing (lint-free) code.
import js from '@eslint/js';
import globals from 'globals';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  // Ignore build output, deps, and coverage artifacts.
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'web/dist/**',
      'coverage/**',
      '**/coverage/**',
      '*.local',
      // Tooling/driver scripts (Playwright harness, etc.) live outside app source
      // and are not part of the production lint scope.
      '.claude/**',
    ],
  },

  // Baseline: ESLint recommended for every linted JS/JSX file.
  js.configs.recommended,

  // Shared language options + hygiene rules for all source files.
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
    },
    rules: {
      // Allow intentionally-unused fn args / leading args via underscore or rest siblings.
      'no-unused-vars': [
        'warn',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
          caughtErrors: 'none',
        },
      ],
      'prefer-const': 'warn',
      'no-var': 'error',
    },
  },

  // Frontend: browser globals + React 19 + JSX.
  {
    files: ['web/src/**/*.{js,jsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: '19' },
    },
    rules: {
      ...reactPlugin.configs.flat.recommended.rules,
      ...reactPlugin.configs.flat['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      // React 19 + Vite use the automatic JSX runtime; no React import needed.
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      // eslint-plugin-react-hooks v7 added strict best-practice rules that flag
      // valid, working patterns in the existing editor code (ref-write-during-render,
      // setState-in-effect). Surface them as warnings — actionable signal for new
      // code — without failing the freshly-introduced gate on pre-existing source.
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },

  // Backend: Node ESM globals (Express server, node:sqlite, scripts).
  {
    files: ['server/**/*.js', 'src/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // Tests: backend node:test files run under Node globals.
  {
    files: ['test/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // Tests: web vitest/testing-library files get browser + vitest globals.
  // Node globals are also included: vitest runs on Node inside a jsdom env, so
  // tests legitimately reference `global`, `process`, `Buffer`, etc. when mocking.
  {
    files: ['web/src/**/*.test.{js,jsx}', 'web/src/test/**/*.{js,jsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.vitest,
      },
    },
  },
];
