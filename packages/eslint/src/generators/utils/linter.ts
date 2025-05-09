/**
 * @deprecated Use LinterType instead. It will be removed in Nx v22.
 */
export enum Linter {
  EsLint = 'eslint',
  None = 'none',
}

export type LinterType = 'eslint' | 'none';
