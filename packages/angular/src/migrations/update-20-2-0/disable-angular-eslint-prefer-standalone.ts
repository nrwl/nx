import { formatFiles, type Tree } from '@nx/devkit';
import {
  addOverrideToLintConfig,
  isEslintConfigSupported,
  lintConfigHasOverride,
  updateOverrideInLintConfig,
} from '@nx/eslint/src/generators/utils/eslint-file';
import { getProjectsFilteredByDependencies } from '../utils/projects';

const preferStandaloneRule = '@angular-eslint/prefer-standalone';

export default async function (tree: Tree) {
  const projects = await getProjectsFilteredByDependencies([
    'npm:@angular/core',
  ]);

  for (const graphNode of projects) {
    const root = graphNode.data.root;
    if (!isEslintConfigSupported(tree, root)) {
      // ESLint config is not supported, skip
      continue;
    }

    if (
      lintConfigHasOverride(
        tree,
        root,
        (o) => !!o.rules?.[preferStandaloneRule],
        true
      )
    ) {
      // the @angular-eslint/prefer-standalone rule is set in an override, skip
      continue;
    }

    const ngEslintOverrideLookup: Parameters<
      typeof lintConfigHasOverride
    >[2] = (o) =>
      o.files?.includes('*.ts') &&
      Object.keys(o.rules ?? {}).some((r) => r.startsWith('@angular-eslint/'));
    const tsFilesOverrideLookup: Parameters<typeof lintConfigHasOverride>[2] = (
      o
    ) => o.files?.length === 1 && o.files[0] === '*.ts';

    if (lintConfigHasOverride(tree, root, ngEslintOverrideLookup, false)) {
      // there is an override containing an Angular ESLint rule
      updateOverrideInLintConfig(tree, root, ngEslintOverrideLookup, (o) => {
        o.rules = {
          ...o.rules,
          [preferStandaloneRule]: 'off',
        };
        return o;
      });
    } else if (
      lintConfigHasOverride(tree, root, tsFilesOverrideLookup, false)
    ) {
      // there is an override for just *.ts files
      updateOverrideInLintConfig(tree, root, tsFilesOverrideLookup, (o) => {
        o.rules = {
          ...o.rules,
          [preferStandaloneRule]: 'off',
        };
        return o;
      });
    } else {
      // there are no overrides for any Angular ESLint rule or just *.ts files, add a new override
      addOverrideToLintConfig(tree, root, {
        files: ['*.ts'],
        rules: {
          [preferStandaloneRule]: 'off',
        },
      });
    }
  }

  await formatFiles(tree);
}
