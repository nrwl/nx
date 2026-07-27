/**
 * The linters Nx generators can set up for a project.
 *
 * Canonical home. `@nx/eslint` re-exports this for back-compat; the copy in
 * `@nx/workspace` is standalone because `@nx/workspace` does not depend on
 * `@nx/js`.
 */
export type LinterType = 'eslint' | 'oxlint' | 'none';
