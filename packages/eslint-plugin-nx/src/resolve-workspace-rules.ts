import type { TSESLint } from '@typescript-eslint/experimental-utils';
import { existsSync } from 'fs';
import { WORKSPACE_PLUGIN_DIR, WORKSPACE_RULE_NAMESPACE } from './constants';

type ESLintRules = Record<string, TSESLint.RuleModule<string, unknown[]>>;

export const workspaceRules = ((): ESLintRules => {
  // If `tools/eslint-rules` folder doesn't exist, there is no point trying to register and load it
  if (!existsSync(WORKSPACE_PLUGIN_DIR)) {
    return {};
  }
  /**
   * Optionally, if swc-node/register is available in the current workspace, apply the require
   * register hooks so that .ts files can be used for writing workspace lint rules.
   *
   * If swc-node/register is not available, the user can still provide an index.js file in
   * tools/eslint-rules and write their rules in JavaScript and the fundamentals will still work (but
   * workspace path mapping will not, for example).
   */
  try {
    require('@swc-node/register')({
      dir: WORKSPACE_PLUGIN_DIR,
    });
  } catch (err) {}
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
