import type { ESLintRuleSeverity } from 'tslint-to-eslint-config';

type TSLintRuleSeverity = 'default' | 'warning' | 'error' | 'off' | boolean;
type TSLintRuleSeverityNonDefaultString = Exclude<
  TSLintRuleSeverity,
  boolean | 'default'
>;

function convertTSLintRuleSeverity(
  tslintConfig: any,
  tslintSeverity: TSLintRuleSeverity
): ESLintRuleSeverity {
  if (tslintSeverity === true) {
    tslintSeverity = 'default';
  }
  if (tslintSeverity === false) {
    tslintSeverity = 'off';
  }
  if (tslintSeverity === 'default') {
    tslintSeverity = tslintConfig.defaultSeverity || 'error';
  }
  const narrowedTslintSeverity =
    tslintSeverity as TSLintRuleSeverityNonDefaultString;
  return narrowedTslintSeverity === 'warning' ? 'warn' : narrowedTslintSeverity;
}

const NX_TSLINT_RULE_NAME = 'nx-enforce-module-boundaries';

export function convertTslintNxRuleToEslintNxRule(
  tslintJson: Record<string, unknown>
): {
  ruleName: string;
  ruleConfig: [ESLintRuleSeverity, Record<string, unknown>];
} | null {
  /**
   * TSLint supports a number of different formats for rule configuration
   */
  const existingRuleDefinition = tslintJson?.rules?.[NX_TSLINT_RULE_NAME];
  if (!existingRuleDefinition) {
    return null;
  }
  let existingRuleSeverity: TSLintRuleSeverity = 'error';
  let existingRuleConfig = {
    enforceBuildableLibDependency: true,
    allow: [],
    depConstraints: [
      {
        sourceTag: '*',
        onlyDependOnLibsWithTags: ['*'],
      },
    ],
  };

  if (Array.isArray(existingRuleDefinition)) {
    existingRuleSeverity = existingRuleDefinition[0];
    existingRuleConfig = existingRuleDefinition[1];
  } else if (
    typeof existingRuleDefinition === 'object' &&
    existingRuleDefinition.severity
  ) {
    existingRuleSeverity = existingRuleDefinition.severity;
    if (
      Array.isArray(existingRuleDefinition.options) &&
      existingRuleDefinition.options[0]
    ) {
      existingRuleConfig = existingRuleDefinition.options[0];
    }
  }

  const ruleSeverity: ESLintRuleSeverity = convertTSLintRuleSeverity(
    tslintJson,
    existingRuleSeverity
  );

  return {
    ruleName: '@nrwl/nx/enforce-module-boundaries',
    ruleConfig: [ruleSeverity, existingRuleConfig],
  };
}
