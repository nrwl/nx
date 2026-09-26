// Semi-private surface for first-party Nx packages; may change without semver.
// Rules come from here rather than `./nx`, whose `workspaceRules` initializer
// compiles the consumer's `tools/eslint-rules` just to reach one rule.
//
// Keep the `const` assignment: `export { default as … } from` breaks the ESM
// named import on Node below 24.14. `internal.spec.ts` pins the shape and
// explains why.
import enforceModuleBoundariesRule from './src/rules/enforce-module-boundaries';

// Keep the annotation: the inferred type names RuleModule via a pnpm store path (TS2883).
export const enforceModuleBoundaries: typeof enforceModuleBoundariesRule =
  enforceModuleBoundariesRule;
