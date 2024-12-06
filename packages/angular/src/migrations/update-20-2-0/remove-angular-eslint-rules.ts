import { formatFiles, type Tree } from '@nx/devkit';
import {
  isEslintConfigSupported,
  lintConfigHasOverride,
  updateOverrideInLintConfig,
} from '@nx/eslint/src/generators/utils/eslint-file';
import { getProjectsFilteredByDependencies } from '../utils/projects';

export default async function (tree: Tree) {
  const projects = await getProjectsFilteredByDependencies(tree, [
    'npm:@angular/core',
  ]);

  for (const {
    project: { root },
  } of projects) {
    if (!isEslintConfigSupported(tree, root)) {
      // ESLint config is not supported, skip
      continue;
    }

    removeRule(tree, root, '@angular-eslint/no-host-metadata-property');
    removeRule(tree, root, '@angular-eslint/sort-ngmodule-metadata-arrays');
    removeRule(tree, root, '@angular-eslint/prefer-standalone-component');
  }

  await formatFiles(tree);
}

function removeRule(tree: Tree, root: string, rule: string) {
  const lookup: Parameters<typeof lintConfigHasOverride>[2] = (o) =>
    !!o.rules?.[rule];
  if (!lintConfigHasOverride(tree, root, lookup, true)) {
    // it's not using the rule, skip
    return;
  }

  // there is an override containing the rule, remove the rule
  updateOverrideInLintConfig(tree, root, lookup, (o) => {
    delete o.rules[rule];
    return o;
  });
}
