import { Tree } from '@nrwl/tao/src/shared/tree';
import { GeneratorCallback } from '@nrwl/tao/src/shared/workspace';
import { Linter, lintProjectGenerator } from '@nrwl/linter';
import {
  addDependenciesToPackageJson,
  joinPathFragments,
  updateJson,
} from '@nrwl/devkit';
import { extraEslintDependencies, reactEslintJson } from '@nrwl/react';
import { NormalizedSchema } from './normalize-options';

export async function addLinting(host: Tree, options: NormalizedSchema) {
  let installTask: GeneratorCallback;

  /**
   * TODO: Remove this use of any once we are consistent across the codebase
   * in our use of the Linter enum. Currently we have one coming from linter
   * and one from workspace and they do not match because one is a const enum
   * and one is not.
   */
  const linter: any = options.linter || Linter.EsLint;

  await lintProjectGenerator(host, {
    linter,
    project: options.projectName,
    tsConfigPaths: [
      joinPathFragments(options.appProjectRoot, 'tsconfig.app.json'),
    ],
    eslintFilePatterns: [`${options.appProjectRoot}/**/*.{ts,tsx,js,jsx}`],
    skipFormat: true,
  });

  if (linter === Linter.EsLint) {
    updateJson(
      host,
      joinPathFragments(options.appProjectRoot, '.eslintrc.json'),
      (json) => {
        json.extends = [...reactEslintJson.extends, ...json.extends];
        return json;
      }
    );
  }

  installTask = await addDependenciesToPackageJson(
    host,
    extraEslintDependencies.dependencies,
    extraEslintDependencies.devDependencies
  );

  return installTask;
}
