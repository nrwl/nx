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

      // Find the override that handles both TS and JS files.
      const commonOverride = json.overrides?.find((o) =>
        ['*.ts', '*.tsx', '*.js', '*.jsx'].every((ext) => o.files.includes(ext))
      );
      if (commonOverride) {
        commonOverride.rules = commonOverride.rules || {};
        commonOverride.rules['@typescript-eslint/ban-ts-comment'] = 'off';
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
