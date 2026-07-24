/**
 * Experimental bridge exposing Nx's `enforce-module-boundaries` rule to Oxlint
 * as a JS plugin.
 *
 * Oxlint's JS-plugin rule context deliberately mirrors ESLint's `RuleContext`
 * (`options`, `report`, `filename`, `sourceCode`, …), so the ESLint rule runs
 * unmodified — `ESLintUtils.RuleCreator` applies `defaultOptions` from
 * `context.options` inside its own `create`.
 *
 * Oxlint's JS-plugin API is excluded from its semver policy and may change in
 * any release.
 */
import * as nxEslintPluginModule from '@nx/eslint-plugin/nx';

const RULE_NAME = 'enforce-module-boundaries';

type EslintRule = { meta?: Record<string, unknown> };
type NxEslintPlugin = { rules: Record<string, EslintRule> };

// `@nx/eslint-plugin/nx` is CJS with both `export default` and
// `module.exports =`, so the shape differs between the ESM namespace and the
// interop default.
const ns = nxEslintPluginModule as unknown as NxEslintPlugin & {
  default?: NxEslintPlugin;
};
const enforceModuleBoundaries = (ns.default ?? ns).rules[RULE_NAME];

// Annotated rather than inferred: the inferred type names `Options` /
// `MessageIds` from a non-portable deep path in `@nx/eslint-plugin` (TS2883).
const nxOxlintBoundariesPlugin: {
  meta: { name: string };
  rules: Record<string, unknown>;
} = {
  meta: { name: '@nx' },
  rules: {
    [RULE_NAME]: {
      ...enforceModuleBoundaries,
      // Oxlint requires a rule name in `meta`; ESLint rule meta has none.
      meta: { ...enforceModuleBoundaries.meta, name: RULE_NAME },
    },
  },
};

export default nxOxlintBoundariesPlugin;
