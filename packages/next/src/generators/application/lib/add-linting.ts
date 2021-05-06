import { Linter, lintProjectGenerator } from '@nrwl/linter';
import {
  Tree,
  GeneratorCallback,
  addDependenciesToPackageJson,
  joinPathFragments,
  updateJson,
} from '@nrwl/devkit';
import { extraEslintDependencies, createReactEslintJson } from '@nrwl/react';
import { NormalizedSchema } from './normalize-options';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';

export async function addLinting(
  host: Tree,
  options: NormalizedSchema
): Promise<GeneratorCallback> {
  const lintTask = await lintProjectGenerator(host, {
    linter: options.linter,
    project: options.projectName,
    tsConfigPaths: [
      joinPathFragments(options.appProjectRoot, 'tsconfig.app.json'),
    ],
    eslintFilePatterns: [`${options.appProjectRoot}/**/*.{ts,tsx,js,jsx}`],
    skipFormat: true,
  });

  if (options.linter === Linter.EsLint) {
    const reactEslintJson = createReactEslintJson(options.appProjectRoot);
    updateJson(
      host,
      joinPathFragments(options.appProjectRoot, '.eslintrc.json'),
      () => {
        if (reactEslintJson.overrides?.[0].parserOptions?.project) {
          reactEslintJson.overrides[0].parserOptions.project = [
            `${options.appProjectRoot}/tsconfig(.*)?.json`,
          ];
        }
        return reactEslintJson;
      }
    );
  }

  const installTask = addDependenciesToPackageJson(
    host,
    extraEslintDependencies.dependencies,
    extraEslintDependencies.devDependencies
  );

  return runTasksInSerial(lintTask, installTask);
}
