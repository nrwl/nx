import { formatFiles, type Tree } from '@nx/devkit';
import {
  findEslintFile,
  isEslintConfigSupported,
  lintConfigHasOverride,
  updateOverrideInLintConfig,
} from '@nx/eslint/src/generators/utils/eslint-file';
import { getProjectsFilteredByDependencies } from '../utils/projects';

export const rulesToRemove = [
  '@angular-eslint/no-host-metadata-property',
  '@angular-eslint/sort-ngmodule-metadata-arrays',
  '@angular-eslint/prefer-standalone-component',
];

export default async function (tree: Tree) {
  const projects = await getProjectsFilteredByDependencies([
    'npm:@angular/core',
  ]);

  let hasRootProject = false;
  for (const graphNode of projects) {
    const root = graphNode.data.root;
    if (!isEslintConfigSupported(tree, root)) {
      // ESLint config is not supported, skip
      continue;
    }

    if (root === '.') {
      hasRootProject = true;
    }

    removeRules(tree, root);
  }

  /**
   * We need to handle both a root config file (e.g. eslint.config.js) and a
   * potential base config file (e.g. eslint.base.config.js). We can't use
   * `findEslintFile` because it would return only one or the other depending
   * on whether a root is provided and the existence of the files. So, we
   * handle each of them separately.
   */

  // check root config, provide a root so it doesn't try to lookup a base config
  if (!hasRootProject) {
    // if there is no root project the root eslint config has not been processed
    if (isEslintConfigSupported(tree, '')) {
      removeRules(tree, '');
    }
  }

  // handle root base config, not providing a root will prioritize a base config
  const baseEslintConfig = findEslintFile(tree);
  if (baseEslintConfig && baseEslintConfig.includes('.base.')) {
    removeRules(tree, baseEslintConfig);
  }

  await formatFiles(tree);
}

function removeRules(tree: Tree, root: string): void {
  for (const rule of rulesToRemove) {
    const lookup: Parameters<typeof lintConfigHasOverride>[2] = (o) =>
      !!o.rules?.[rule];
    if (!lintConfigHasOverride(tree, root, lookup)) {
      // it's not using the rule, skip
      continue;
    }

    // there is an override containing the rule, remove the rule
    updateOverrideInLintConfig(tree, root, lookup, (o) => {
      delete o.rules[rule];
      return o;
    });
  }
}
