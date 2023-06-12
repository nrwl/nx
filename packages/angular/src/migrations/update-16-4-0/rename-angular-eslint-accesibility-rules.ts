import type { Tree } from '@nx/devkit';
import { formatFiles, updateJson, visitNotIgnoredFiles } from '@nx/devkit';

// https://github.com/angular-eslint/angular-eslint/blob/24a4de54a8991c93924abf1dfb78b132a6269aef/packages/schematics/src/migrations/update-16-0-0/update-16-0-0.ts
export default async function (tree: Tree): Promise<void> {
  visitNotIgnoredFiles(tree, '.', (filePath) => {
    if (!filePath.endsWith('.eslintrc.json')) {
      return;
    }

    updateJson(tree, filePath, (json) => {
      if (json.overrides) {
        for (const override of json.overrides) {
          modifyRules(override);
        }
      }

      modifyRules(json);
      return json;
    });
  });

  await formatFiles(tree);
}

function modifyRules(parent: { rules?: Record<string, unknown> }) {
  if (!parent.rules) {
    return;
  }

  for (const rule of Object.keys(parent.rules)) {
    if (rule.startsWith('@angular-eslint/template/accessibility-')) {
      const ruleConfig = parent.rules[rule];
      parent.rules[
        rule.replace(
          '@angular-eslint/template/accessibility-',
          '@angular-eslint/template/'
        )
      ] = ruleConfig;
      delete parent.rules[rule];
    }
  }
}
