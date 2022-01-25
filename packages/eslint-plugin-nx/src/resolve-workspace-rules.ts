import type { TSESLint } from '@typescript-eslint/experimental-utils';
import { existsSync } from 'fs';
import { WORKSPACE_PLUGIN_DIR, WORKSPACE_RULE_NAMESPACE } from './constants';

type ESLintRules = Record<string, TSESLint.RuleModule<string, unknown[]>>;

/**
 * Optionally, if ts-node and tsconfig-paths are available in the current workspace, apply the require
 * register hooks so that .ts files can be used for writing workspace lint rules.
 *
 * If ts-node and tsconfig-paths are not available, the user can still provide an index.js file in
 * tools/eslint-rules and write their rules in JavaScript and the fundamentals will still work (but
 * workspace path mapping will not, for example).
 */
function registerTSWorkspaceLint() {
  try {
    require('ts-node').register({
      dir: WORKSPACE_PLUGIN_DIR,
    });

    const tsconfigPaths = require('tsconfig-paths');

    // Load the tsconfig from tools/eslint-rules/tsconfig.json
    const tsConfigResult = tsconfigPaths.loadConfig(WORKSPACE_PLUGIN_DIR);

    /**
     * Register the custom workspace path mappings with node so that workspace libraries
     * can be imported and used within custom workspace lint rules.
     */
    tsconfigPaths.register({
      baseUrl: tsConfigResult.absoluteBaseUrl,
      paths: tsConfigResult.paths,
    });
  } catch (err) {}
}

export const workspaceRules = ((): ESLintRules => {
  // If `tools/eslint-rules` folder doesn't exist, there is no point trying to register and load it
  if (!existsSync(WORKSPACE_PLUGIN_DIR)) {
    return {};
  }
  // Register `tools/eslint-rules` for TS transpilation
  registerTSWorkspaceLint();
  try {
    /**
     * Currently we only support applying the rules from the user's workspace plugin object
     * (i.e. not other things that plugings can expose like configs, processors etc)
     */
    const { rules } = require(WORKSPACE_PLUGIN_DIR);

    // Apply the namespace to the resolved rules
    const namespacedRules: ESLintRules = {};
    for (const [ruleName, ruleConfig] of Object.entries(rules as ESLintRules)) {
      namespacedRules[`${WORKSPACE_RULE_NAMESPACE}/${ruleName}`] = ruleConfig;
    }
    return namespacedRules;
  } catch (err) {
    return {};
  }
})();
