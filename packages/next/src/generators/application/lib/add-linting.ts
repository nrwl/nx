import { Linter, lintProjectGenerator } from '@nrwl/linter';
import {
  addDependenciesToPackageJson,
  GeneratorCallback,
  joinPathFragments,
  Tree,
  updateJson,
} from '@nrwl/devkit';
import { createReactEslintJson, extraEslintDependencies } from '@nrwl/react';
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
        // Turn off @next/next/no-html-link-for-pages since there is an issue with nextjs throwing linting errors
        // TODO(nicholas): remove after Vercel updates nextjs linter to only lint ["*.ts", "*.tsx", "*.js", "*.jsx"]

        reactEslintJson.rules = {
          '@next/next/no-html-link-for-pages': 'off',
          ...reactEslintJson.rules,
        };
        // Find the override that handles both TS and JS files.
        const commonOverride = reactEslintJson.overrides?.find((o) =>
          ['*.ts', '*.tsx', '*.js', '*.jsx'].every((ext) =>
            o.files.includes(ext)
          )
        );
        if (commonOverride) {
          // Only set parserOptions.project if it already exists (defined by options.setParserOptionsProject)
          if (commonOverride.parserOptions?.project) {
            commonOverride.parserOptions.project = [
              `${options.appProjectRoot}/tsconfig(.*)?.json`,
            ];
          }
          // Configure custom pages directory for next rule
          if (commonOverride.rules) {
            commonOverride.rules = {
              ...commonOverride.rules,
              '@next/next/no-html-link-for-pages': [
                'error',
                `${options.appProjectRoot}/pages`,
              ],
            };
          }
        }
        reactEslintJson.extends ??= [];
        if (typeof reactEslintJson.extends === 'string') {
          reactEslintJson.extends = [reactEslintJson.extends];
        }
        // add next.js configuration
        reactEslintJson.extends.unshift(...['next', 'next/core-web-vitals']);
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
