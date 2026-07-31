// Semi-private surface for first-party Nx packages.
//
// External plugins should NOT import from here — this entry is curated for
// internal consumers and may change without semver protection. Mirrors
// `@nx/eslint/internal`.
//
// Rules are re-exported individually on purpose. The `./nx` plugin entry
// spreads `workspaceRules`, whose module-level initializer compiles the
// workspace's `tools/eslint-rules` directory (when the workspace has one);
// reaching a single rule through that entry pays for all of it.
//
// Assigned to a `const` rather than `export { default as … } from`: this package
// is CJS and `@nx/oxlint` is ESM, and under `esModuleInterop` that form emits a
// getter whose body calls `__importDefault(…)`. Node's CJS named-export analyzer
// only follows plain assignments and bare-member getters until 24.14, where the
// analyzer changed from cjs-module-lexer to merve — so below that the name never
// reaches the ESM facade. `internal.spec.ts` pins the shape.
import enforceModuleBoundariesRule from './src/rules/enforce-module-boundaries';

export const enforceModuleBoundaries = enforceModuleBoundariesRule;
