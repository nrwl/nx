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
    const reactEslintJson = createReactEslintJson(
      options.appProjectRoot,
      options.setParserOptionsProject
    );
    updateJson(
      host,
      joinPathFragments(options.appProjectRoot, '.eslintrc.json'),
      () => {
        // Only set parserOptions.project if it already exists (defined by options.setParserOptionsProject)
        if (reactEslintJson.overrides?.[0].parserOptions?.project) {
          reactEslintJson.overrides[0].parserOptions.project = [
            `${options.appProjectRoot}/tsconfig(.*)?.json`,
          ];
        }
        if (!reactEslintJson.extends) {
          reactEslintJson.extends = [];
        }
        if (typeof reactEslintJson.extends === 'string') {
          reactEslintJson.extends = [reactEslintJson.extends];
        }
        // add next.js configuration
        reactEslintJson.extends.push(...['next', 'next/core-web-vitals']);
        // remove nx/react plugin, as it conflicts with the next.js one
        reactEslintJson.extends = reactEslintJson.extends.filter(
          (name) => name !== 'plugin:@nrwl/nx/react'
        );
        reactEslintJson.extends.unshift('plugin:@nrwl/nx/react-typescript');
        if (!reactEslintJson.env) {
          reactEslintJson.env = {};
        }
        reactEslintJson.env.jest = true;
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
