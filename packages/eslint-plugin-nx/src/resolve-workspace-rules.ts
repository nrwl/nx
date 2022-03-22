import type { TSESLint } from '@typescript-eslint/experimental-utils';
import { existsSync } from 'fs';
import { WORKSPACE_PLUGIN_DIR, WORKSPACE_RULE_NAMESPACE } from './constants';
import { registerTsProject } from 'nx/src/utils/register';

type ESLintRules = Record<string, TSESLint.RuleModule<string, unknown[]>>;

export const workspaceRules = ((): ESLintRules => {
  // If `tools/eslint-rules` folder doesn't exist, there is no point trying to register and load it
  if (!existsSync(WORKSPACE_PLUGIN_DIR)) {
    return {};
  }
  // Register `tools/eslint-rules` for TS transpilation
  const registrationCleanup = registerTsProject(WORKSPACE_PLUGIN_DIR);
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
  } finally {
    if (registrationCleanup) {
      registrationCleanup();
    }
  }
})();
