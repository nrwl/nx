import type { TSESLint } from '@typescript-eslint/utils';
import { existsSync } from 'fs';
import { registerTsProject } from '@nx/js/src/internal';
import { WORKSPACE_PLUGIN_DIR, WORKSPACE_RULE_PREFIX } from './constants';
import { join } from 'path';

type ESLintRules = Record<string, TSESLint.RuleModule<string, unknown[]>>;

export const workspaceRules = ((): ESLintRules => {
  // If `tools/eslint-rules` folder doesn't exist, there is no point trying to register and load it
  if (!existsSync(WORKSPACE_PLUGIN_DIR)) {
    return {};
  }
  // Register `tools/eslint-rules` for TS transpilation
  const registrationCleanup = registerTsProject(
    join(WORKSPACE_PLUGIN_DIR, 'tsconfig.json')
  );
  try {
    /**
     * Currently we only support applying the rules from the user's workspace plugin object
     * (i.e. not other things that plugings can expose like configs, processors etc)
     */
    const { rules } = require(WORKSPACE_PLUGIN_DIR);

    // Apply the namespace to the resolved rules
    const namespacedRules: ESLintRules = {};
    for (const [ruleName, ruleConfig] of Object.entries(rules as ESLintRules)) {
      namespacedRules[`${WORKSPACE_RULE_PREFIX}-${ruleName}`] = ruleConfig;
      // keep the old namespaced rules for backwards compatibility
      namespacedRules[`${WORKSPACE_RULE_PREFIX}/${ruleName}`] = ruleConfig;
    }
    return namespacedRules;
  } catch (err) {
    console.error(err);
    return {};
  } finally {
    if (registrationCleanup) {
      registrationCleanup();
    }
  }
})();
