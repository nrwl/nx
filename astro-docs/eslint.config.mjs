import { baseConfig } from '../eslint.config.mjs';
import playwright from 'eslint-plugin-playwright';

export default [
  ...baseConfig,
  playwright.configs['flat/recommended'],
  {
    files: ['**/*.spec.ts', '**/*.test.ts', '**/*.spec.js', '**/*.test.js'],
    rules: {
      'playwright/no-standalone-expect': 'off',
    },
  },
  {
    ignores: [
      'node_modules/',
      'dist/',
      '.astro/',
      '.netlify/',
      'test-output/',
      'playwright-report/',
      'src/content/banner.json',
    ],
  },
];
