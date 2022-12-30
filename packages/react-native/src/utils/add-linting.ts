import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import { Linter, lintProjectGenerator } from '@nrwl/linter';
import {
  addDependenciesToPackageJson,
  GeneratorCallback,
  joinPathFragments,
  Tree,
  updateJson,
} from '@nrwl/devkit';
import { extendReactEslintJson, extraEslintDependencies } from '@nrwl/react';
import type { Linter as ESLintLinter } from 'eslint';

interface NormalizedSchema {
  linter?: Linter;
  projectName: string;
  projectRoot: string;
  setParserOptionsProject?: boolean;
  tsConfigPaths: string[];
  skipPackageJson?: boolean;
}

export async function addLinting(host: Tree, options: NormalizedSchema) {
  if (options.linter === Linter.None) {
    return () => {};
  }
  const tasks: GeneratorCallback[] = [];

  const lintTask = await lintProjectGenerator(host, {
    linter: options.linter,
    project: options.projectName,
    tsConfigPaths: options.tsConfigPaths,
    eslintFilePatterns: [`${options.projectRoot}/**/*.{ts,tsx,js,jsx}`],
    skipFormat: true,
    skipPackageJson: options.skipPackageJson,
  });

  tasks.push(lintTask);

  updateJson(
    host,
    joinPathFragments(options.projectRoot, '.eslintrc.json'),
    (json: ESLintLinter.Config) => {
      json = extendReactEslintJson(json);

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

  if (!options.skipPackageJson) {
    const installTask = await addDependenciesToPackageJson(
      host,
      extraEslintDependencies.dependencies,
      extraEslintDependencies.devDependencies
    );
    tasks.push(installTask);
  }

  return runTasksInSerial(...tasks);
}
