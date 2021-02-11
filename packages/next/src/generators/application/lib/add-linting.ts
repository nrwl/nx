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

  await lintProjectGenerator(host, {
    linter: Linter.EsLint,
    project: options.projectName,
    tsConfigPaths: [
      joinPathFragments(options.appProjectRoot, 'tsconfig.app.json'),
    ],
    eslintFilePatterns: [`${options.appProjectRoot}/**/*.{ts,tsx,js,jsx}`],
    skipFormat: true,
  });

  updateJson(
    host,
    joinPathFragments(options.appProjectRoot, '.eslintrc.json'),
    (json) => {
      json.extends = [...reactEslintJson.extends, ...json.extends];
      return json;
    }
  );

  installTask = await addDependenciesToPackageJson(
    host,
    extraEslintDependencies.dependencies,
    extraEslintDependencies.devDependencies
  );

  return installTask;
}
