// This migration is mostly copied from https://github.com/angular-eslint/angular-eslint/blob/3c5a9d43264c9cbdd8fe8f2ebb19c613396386c2/packages/schematics/src/migrations/update-12-0-0/update-12-0-0.ts

import {
  formatFiles,
  Tree,
  updateJson,
  visitNotIgnoredFiles,
} from '@nrwl/devkit';
import { basename } from 'path';
import type { Linter } from 'eslint';

export default async function (tree: Tree) {
  visitNotIgnoredFiles(tree, '', (file) => {
    if (basename(file) !== '.eslintrc.json') {
      return;
    }

    updateJson(tree, file, (eslintJson: Linter.Config) => {
      migrateAngularEsLintRules(eslintJson);
      return eslintJson;
    });
  });
  await formatFiles(tree);
}

function migrateAngularEsLintRules({ overrides, rules }: Linter.Config) {
  migrateToAccessibilityLabelHasAssociatedControlSchema(
    rules?.['@angular-eslint/template/accessibility-label-for']
  );
  migrateToAccessibilityLabelHasAssociatedControlName(rules);
  addEqeqeqIfNeeded(rules);
  for (const o of overrides ?? []) {
    migrateToAccessibilityLabelHasAssociatedControlSchema(
      o.rules?.['@angular-eslint/template/accessibility-label-for']
    );
    migrateToAccessibilityLabelHasAssociatedControlName(o.rules);
    addEqeqeqIfNeeded(o.rules);
  }
}

function migrateToAccessibilityLabelHasAssociatedControlName(
  rules: Partial<Linter.RulesRecord> | undefined
) {
  if (!rules) return;
  const accessibilityLabelForRule =
    rules['@angular-eslint/template/accessibility-label-for'];
  delete rules['@angular-eslint/template/accessibility-label-for'];
  rules['@angular-eslint/template/accessibility-label-has-associated-control'] =
    accessibilityLabelForRule;
}

function migrateToAccessibilityLabelHasAssociatedControlSchema(
  rule: Linter.RuleEntry | undefined
) {
  if (!Array.isArray(rule) || rule.length !== 2) return;
  const [, currentSchema] = rule;
  rule[1] = {
    controlComponents: currentSchema.controlComponents,
    labelComponents: currentSchema.labelComponents.map((selector: string) => {
      return { inputs: currentSchema.labelAttributes, selector };
    }),
  };
}
function addEqeqeqIfNeeded(rules: Partial<Linter.RulesRecord> | undefined) {
  if (
    !rules ||
    !rules['@angular-eslint/template/no-negated-async'] ||
    rules['@angular-eslint/template/eqeqeq']
  ) {
    return;
  }

  rules['@angular-eslint/template/eqeqeq'] = 'error';
}
