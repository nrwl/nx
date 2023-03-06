import { Linter, lintProjectGenerator } from '@nrwl/linter';
import {
  addDependenciesToPackageJson,
  joinPathFragments,
  runTasksInSerial,
  Tree,
  updateJson,
} from '@nrwl/devkit';
import { extendReactEslintJson, extraEslintDependencies } from '@nrwl/react';
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
    setParserOptionsProject,
  });

  updateJson(
    host,
    joinPathFragments(appProjectRoot, '.eslintrc.json'),
    (json: ESLintLinter.Config) => {
      json = extendReactEslintJson(json);

      json.ignorePatterns = [
        ...json.ignorePatterns,
        '.expo',
        'node_modules',
        'web-build',
        'cache',
      ];

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
