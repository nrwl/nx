import type { TSESLint } from '@typescript-eslint/utils';
import { workspaceRules } from './src/resolve-workspace-rules';
import dependencyChecks, {
  RULE_NAME as dependencyChecksRuleName,
} from './src/rules/dependency-checks';
import enforceModuleBoundaries, {
  RULE_NAME as enforceModuleBoundariesRuleName,
} from './src/rules/enforce-module-boundaries';
import nxPluginChecksRule, {
  RULE_NAME as nxPluginChecksRuleName,
} from './src/rules/nx-plugin-checks';

// Keep the annotation: the inferred type names RuleModule via a pnpm store path (TS2883).
const plugin: {
  configs: Record<string, unknown>;
  rules: Record<string, TSESLint.RuleModule<string, unknown[]>>;
} = {
  configs: {},
  rules: {
    [enforceModuleBoundariesRuleName]: enforceModuleBoundaries,
    [nxPluginChecksRuleName]: nxPluginChecksRule,
    [dependencyChecksRuleName]: dependencyChecks,
    // Resolve any custom rules that might exist in the current workspace
    ...workspaceRules,
  },
};

// ESM
export default plugin;

// CommonJS
module.exports = plugin;
