import type { Linter } from 'eslint';

// Cache the resolved rules from node_modules
let knownRulesRequiringTypeChecking: string[] | null = null;

function resolveKnownRulesRequiringTypeChecking(): string[] | null {
  if (knownRulesRequiringTypeChecking) {
    return knownRulesRequiringTypeChecking;
  }
  try {
    const { rules } = require('@typescript-eslint/eslint-plugin');
    const rulesRequiringTypeInfo = Object.entries(rules)
      .map(([ruleName, config]) => {
        if ((config as any).meta?.docs?.requiresTypeChecking) {
          return `@typescript-eslint/${ruleName}`;
        }
        return null;
      })
      .filter(Boolean);
    return rulesRequiringTypeInfo;
  } catch (err) {
    console.log(err);
    return null;
  }
}

export function hasRulesRequiringTypeChecking(
  eslintConfig: Linter.Config
): boolean {
  knownRulesRequiringTypeChecking = resolveKnownRulesRequiringTypeChecking();
  if (!knownRulesRequiringTypeChecking) {
    /**
     * If (unexpectedly) known rules requiring type checking could not be resolved,
     * default to assuming that the rules are in use to align most closely with Nx
     * ESLint configs to date.
     */
    return true;
  }
  const allRulesInConfig = getAllRulesInConfig(eslintConfig);
  return allRulesInConfig.some((rule) =>
    knownRulesRequiringTypeChecking.includes(rule)
  );
}

export function removeParserOptionsProjectIfNotRequired(
  json: Linter.Config
): Linter.Config {
  // At least one rule requiring type-checking is in use, do not migrate the config
  if (hasRulesRequiringTypeChecking(json)) {
    return json;
  }
  removeProjectParserOptionFromConfig(json);
  return json;
}

function determineEnabledRules(rules: Linter.RulesRecord): string[] {
  return Object.entries(rules)
    .filter(([key, value]) => {
      return !(typeof value === 'string' && value === 'off');
    })
    .map(([ruleName]) => ruleName);
}

function getAllRulesInConfig(json: Linter.Config): string[] {
  let allRules = json.rules ? determineEnabledRules(json.rules) : [];
  if (json.overrides?.length > 0) {
    for (const o of json.overrides) {
      if (o.rules) {
        allRules = allRules = [...allRules, ...determineEnabledRules(o.rules)];
      }
    }
  }
  return allRules;
}

function removeProjectParserOptionFromConfig(json: Linter.Config): void {
  delete json.parserOptions?.project;
  // If parserOptions is left empty by this removal, also clean up the whole object
  if (json.parserOptions && Object.keys(json.parserOptions).length === 0) {
    delete json.parserOptions;
  }
  if (json.overrides) {
    for (const override of json.overrides) {
      delete override.parserOptions?.project;
      // If parserOptions is left empty by this removal, also clean up the whole object
      if (
        override.parserOptions &&
        Object.keys(override.parserOptions).length === 0
      ) {
        delete override.parserOptions;
      }
    }
  }
}
