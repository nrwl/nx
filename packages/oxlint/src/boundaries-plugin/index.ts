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
// Imported from `/internal` rather than the `/nx` plugin entry: that entry
// spreads `workspaceRules`, whose module-level initializer compiles the
// consuming workspace's `tools/eslint-rules` directory just to hand back one
// rule.
import { enforceModuleBoundaries } from '@nx/eslint-plugin/internal';

const RULE_NAME = 'enforce-module-boundaries';

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
      // Oxlint takes the rule's name from this object's key, not from `meta` —
      // it is `meta.name` on the *plugin* above that it requires. Carrying the
      // name here anyway keeps the rule self-describing, since
      // `ESLintUtils.RuleCreator` keeps `name` as a sibling of `meta` rather
      // than inside it.
      meta: { ...enforceModuleBoundaries.meta, name: RULE_NAME },
    },
  },
};

export default nxOxlintBoundariesPlugin;
