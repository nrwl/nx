import { workspaceRules } from './resolve-workspace-rules.js';
import dependencyChecks, {
  RULE_NAME as dependencyChecksRuleName,
} from './rules/dependency-checks';
import enforceModuleBoundaries, {
  RULE_NAME as enforceModuleBoundariesRuleName,
} from './rules/enforce-module-boundaries';
import nxPluginChecksRule, {
  RULE_NAME as nxPluginChecksRuleName,
} from './rules/nx-plugin-checks';

const plugin = {
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
