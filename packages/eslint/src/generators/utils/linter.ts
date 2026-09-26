/**
 * @deprecated Use LinterType instead. It will be removed in Nx v22.
 */
export enum Linter {
  EsLint = 'eslint',
  None = 'none',
}

// Canonical definition lives in `@nx/js` so linter-agnostic code can reach it
// without depending on a specific linter plugin.
export type { LinterType } from '@nx/js';
