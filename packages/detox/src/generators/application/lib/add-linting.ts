import { Linter, lintProjectGenerator } from '@nx/linter';
import {
  addDependenciesToPackageJson,
  joinPathFragments,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { extraEslintDependencies } from '@nx/react';
import { NormalizedSchema } from './normalize-options';
import {
  addExtendsToLintConfig,
  isEslintConfigSupported,
} from '@nx/linter/src/generators/utils/eslint-file';

export async function addLinting(host: Tree, options: NormalizedSchema) {
  if (options.linter === Linter.None) {
    return () => {};
  }

  const lintTask = await lintProjectGenerator(host, {
    linter: options.linter,
    project: options.e2eProjectName,
    tsConfigPaths: [
      joinPathFragments(options.e2eProjectRoot, 'tsconfig.app.json'),
    ],
    eslintFilePatterns: [`${options.e2eProjectRoot}/**/*.{ts,tsx,js,jsx}`],
    skipFormat: true,
  });

  if (isEslintConfigSupported(host)) {
    addExtendsToLintConfig(host, options.e2eProjectRoot, 'plugin:@nx/react');
  }

  const installTask = addDependenciesToPackageJson(
    host,
    extraEslintDependencies.dependencies,
    extraEslintDependencies.devDependencies
  );

  return runTasksInSerial(lintTask, installTask);
}
