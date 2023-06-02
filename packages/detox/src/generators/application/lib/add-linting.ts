import { Linter, lintProjectGenerator } from '@nx/linter';
import {
  addDependenciesToPackageJson,
  joinPathFragments,
  runTasksInSerial,
  Tree,
  updateJson,
} from '@nx/devkit';
import { extendReactEslintJson, extraEslintDependencies } from '@nx/react';
import { NormalizedSchema } from './normalize-options';

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

  updateJson(
    host,
    joinPathFragments(options.e2eProjectRoot, '.eslintrc.json'),
    extendReactEslintJson
  );

  const installTask = addDependenciesToPackageJson(
    host,
    extraEslintDependencies.dependencies,
    extraEslintDependencies.devDependencies
  );

  return runTasksInSerial(lintTask, installTask);
}
