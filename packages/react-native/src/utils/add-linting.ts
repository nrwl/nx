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

interface LintingSchema {
  linter?: Linter;
  js?: boolean;
  unitTestRunner?: 'jest' | 'none';
  setParserOptionsProject?: boolean;
}

// options.name,
// options.projectRoot,
// [joinPathFragments(options.projectRoot, 'tsconfig.lib.json')],
// options.linter,
// options.setParserOptionsProject

export async function addLinting(
  host: Tree,
  projectName: string,
  tsConfigFileName: string,
  projectRoot: string,
  options: LintingSchema
) {
  if (options.linter === Linter.None) {
    return () => {};
  }

  const lintTask = await lintProjectGenerator(host, {
    linter: options.linter,
    project: projectName,
    js: options.js,
    unitTestRunner: options.unitTestRunner,
    tsConfigPaths: [joinPathFragments(projectRoot, tsConfigFileName)],
    eslintFilePatterns: [`${projectRoot}/**/*.{ts,tsx,js,jsx}`],
    skipFormat: true,
  });

  if (options.linter === Linter.TsLint) {
    return () => {};
  }

  const reactEslintJson = createReactEslintJson(
    projectRoot,
    options.setParserOptionsProject
  );

  updateJson(
    host,
    joinPathFragments(projectRoot, '.eslintrc.json'),
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
