/*
 * @deprecated Use LinterType instead
 */
export const enum Linter {
  EsLint = 'eslint',
  None = 'none',
}

// Standalone copy of the canonical `LinterType` in `@nx/js`: `@nx/workspace`
// does not depend on `@nx/js`. `@nx/js`'s `linter.ts` asserts the two are
// identical, so drift here fails that package's build rather than this one's.
export type LinterType = 'eslint' | 'oxlint' | 'none';
