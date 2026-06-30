/* eslint-env node */

/**
 * ESLint configuration for Revploy.
 *
 * Architectural boundaries are enforced with `eslint-plugin-boundaries` at the
 * `error` level. The element types below mirror the `src/` folder structure:
 *
 *   - app      → src/main.tsx (composition root, may import anything)
 *   - routes   → src/routes/**
 *   - layouts  → src/layouts/**
 *   - modules  → src/modules/<module>/** (feature-scoped)
 *   - shared   → src/shared/** (cross-cutting, must not depend on features)
 *
 * Dependency rules (allow-list — anything not allowed is an error):
 *   - shared may only depend on shared
 *   - modules may depend on shared and their OWN module (no cross-module imports)
 *   - layouts may depend on shared
 *   - routes may depend on shared, layouts and modules
 *   - app may depend on everything
 */
module.exports = {
  root: true,
  env: { browser: true, es2021: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'plugin:boundaries/recommended',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'react-refresh', 'boundaries'],
  ignorePatterns: [
    'dist',
    'node_modules',
    '.eslintrc.cjs',
    'vite.config.ts',
    'postcss.config.js',
    'tailwind.config.ts',
    'supabase/functions/**',
  ],
  settings: {
    'import/resolver': {
      typescript: {
        project: './tsconfig.app.json',
      },
    },
    'boundaries/include': ['src/**/*.{ts,tsx}'],
    'boundaries/ignore': ['src/**/*.d.ts', 'src/**/*.css'],
    'boundaries/elements': [
      { type: 'app', pattern: 'src/main.tsx', mode: 'file' },
      { type: 'routes', pattern: 'src/routes/**' },
      { type: 'layouts', pattern: 'src/layouts/**' },
      {
        type: 'modules',
        pattern: 'src/modules/*/**',
        capture: ['module'],
      },
      { type: 'shared', pattern: 'src/shared/**' },
    ],
  },
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    'boundaries/no-unknown': ['error'],
    'boundaries/no-unknown-files': ['error'],
    'boundaries/element-types': [
      'error',
      {
        default: 'disallow',
        rules: [
          {
            from: ['app'],
            allow: ['app', 'routes', 'layouts', 'modules', 'shared'],
          },
          {
            from: ['routes'],
            allow: ['routes', 'layouts', 'modules', 'shared'],
          },
          {
            from: ['layouts'],
            allow: ['layouts', 'shared'],
          },
          {
            from: ['modules'],
            allow: ['shared', ['modules', { module: '${from.module}' }]],
          },
          {
            from: ['shared'],
            allow: ['shared'],
          },
        ],
      },
    ],
  },
}
