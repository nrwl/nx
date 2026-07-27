/*
 * @deprecated Use LinterType instead
 */
export const enum Linter {
  EsLint = 'eslint',
  None = 'none',
}

// Standalone copy of the canonical `LinterType` in `@nx/js`: `@nx/workspace`
// does not depend on `@nx/js`. Keep the two in sync.
export type LinterType = 'eslint' | 'oxlint' | 'none';
