import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import { Linter, lintProjectGenerator } from '@nrwl/linter';
import {
  addDependenciesToPackageJson,
  joinPathFragments,
  updateJson,
  Tree,
} from '@nrwl/devkit';
import { extraEslintDependencies, createReactEslintJson } from '@nrwl/react';
import type { Linter as ESLintLinter } from 'eslint';

export async function addLinting(
  host: Tree,
  projectName: string,
  appProjectRoot: string,
  tsConfigPaths: string[],
  linter: Linter,
  setParserOptionsProject?: boolean
) {
  if (linter === Linter.None) {
    return () => {};
  }

  const lintTask = await lintProjectGenerator(host, {
    linter,
    project: projectName,
    tsConfigPaths,
    eslintFilePatterns: [`${appProjectRoot}/**/*.{ts,tsx,js,jsx}`],
    skipFormat: true,
  });

  if (linter === Linter.TsLint) {
    return () => {};
  }

  const reactEslintJson = createReactEslintJson(
    appProjectRoot,
    setParserOptionsProject
  );

  updateJson(
    host,
    joinPathFragments(appProjectRoot, '.eslintrc.json'),
    (json: ESLintLinter.Config) => {
      json = reactEslintJson;
      json.ignorePatterns = ['!**/*', 'public', '.cache', 'node_modules'];

      for (const override of json.overrides) {
        if (!override.files || override.files.length !== 2) {
          continue;
        }

        // for files ['*.tsx', '*.ts'], add rule '@typescript-eslint/ban-ts-comment': 'off'
        if (
          override.files.includes('*.ts') &&
          override.files.includes('*.tsx')
        ) {
          override.rules = override.rules || {};
          override.rules['@typescript-eslint/ban-ts-comment'] = 'off';
          continue;
        }

        // for files ['*.js', '*.jsx'], add rule '@typescript-eslint/no-var-requires': 'off'
        if (
          override.files.includes('*.js') &&
          override.files.includes('*.jsx')
        ) {
          override.rules = override.rules || {};
          override.rules['@typescript-eslint/no-var-requires'] = 'off';
          continue;
        }
      }

      return json;
    }
  );

  const installTask = await addDependenciesToPackageJson(
    host,
    extraEslintDependencies.dependencies,
    extraEslintDependencies.devDependencies
  );

  return runTasksInSerial(lintTask, installTask);
}
