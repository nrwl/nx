import { Linter, lintProjectGenerator } from '@nx/linter';
import {
  addDependenciesToPackageJson,
  GeneratorCallback,
  joinPathFragments,
  runTasksInSerial,
  Tree,
  updateJson,
} from '@nx/devkit';
import {
  extendReactEslintJson,
  extraEslintDependencies,
} from '@nx/react/src/utils/lint';
import { NormalizedSchema } from './normalize-options';

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
    unitTestRunner: options.unitTestRunner,
    eslintFilePatterns: [`${options.appProjectRoot}/**/*.{ts,tsx,js,jsx}`],
    skipFormat: true,
    rootProject: options.rootProject,
  });

  if (options.linter === Linter.EsLint) {
    updateJson(
      host,
      joinPathFragments(options.appProjectRoot, '.eslintrc.json'),
      (json) => {
        json = extendReactEslintJson(json);

        // Turn off @next/next/no-html-link-for-pages since there is an issue with nextjs throwing linting errors
        // TODO(nicholas): remove after Vercel updates nextjs linter to only lint ["*.ts", "*.tsx", "*.js", "*.jsx"]

        json.ignorePatterns = [...json.ignorePatterns, '.next/**/*'];

        json.rules = {
          '@next/next/no-html-link-for-pages': 'off',
          ...json.rules,
        };

        // Find the override that handles both TS and JS files.
        const commonOverride = json.overrides?.find((o) =>
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

        json.extends ??= [];
        if (typeof json.extends === 'string') {
          json.extends = [json.extends];
        }
        // add next.js configuration
        json.extends.unshift(...['next', 'next/core-web-vitals']);
        // remove nx/react plugin, as it conflicts with the next.js one
        json.extends = json.extends.filter(
          (name) =>
            name !== 'plugin:@nx/react' && name !== 'plugin:@nrwl/nx/react'
        );

        json.extends.unshift('plugin:@nx/react-typescript');
        if (!json.env) {
          json.env = {};
        }
        json.env.jest = true;

        return json;
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
