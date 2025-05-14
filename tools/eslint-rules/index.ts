import {
  RULE_NAME as ensurePnpmLockVersionName,
  rule as ensurePnpmLockVersion,
} from './rules/ensure-pnpm-lock-version';
import {
  RULE_NAME as validCommandObjectName,
  rule as validCommandObject,
} from './rules/valid-command-object';
import {
  RULE_NAME as validSchemaDescriptionName,
  rule as validSchemaDescription,
} from './rules/valid-schema-description';
/**
 * Import your custom workspace rules at the top of this file.
 *
 * For example:
 *
 * import { RULE_NAME as myCustomRuleName, rule as myCustomRule } from './rules/my-custom-rule';
 *
 * In order to quickly get started with writing rules you can use the
 * following generator command and provide your desired rule name:
 *
 * ```sh
 * npx nx g @nx/eslint:workspace-rule {{ NEW_RULE_NAME }}
 * ```
 */

module.exports = {
  /**
   * Apply the imported custom rules here.
   *
   * For example (using the example import above):
   *
   * rules: {
   *  [myCustomRuleName]: myCustomRule
   * }
   */
  rules: {
    [validSchemaDescriptionName]: validSchemaDescription,
    [validCommandObjectName]: validCommandObject,
    [ensurePnpmLockVersionName]: ensurePnpmLockVersion,
  },
};
