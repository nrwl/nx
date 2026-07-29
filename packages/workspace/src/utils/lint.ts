// Duplicated from `@nx/eslint` rather than re-exported: `@nx/workspace` does not
// depend on it, and a type-only import would still land in the emitted `.d.ts`
// and break consumers that have not installed it. Keep the two in sync.
export type LinterType = 'eslint' | 'none';
