import { Linter, lintProjectGenerator } from '@nx/linter';
import {
  addDependenciesToPackageJson,
  GeneratorCallback,
  joinPathFragments,
  runTasksInSerial,
  Tree,
  updateJson,
} from '@nx/devkit';
import { extraEslintDependencies } from '@nx/react/src/utils/lint';
import { NormalizedSchema } from './normalize-options';
import {
  addExtendsToLintConfig,
  addIgnoresToLintConfig,
  addOverrideToLintConfig,
} from '@nx/linter/src/generators/utils/eslint-file';

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
    addExtendsToLintConfig(host, options.appProjectRoot, [
      'plugin:@nx/react-typescript',
      'next',
      'next/core-web-vitals',
    ]);
    addIgnoresToLintConfig(host, options.appProjectRoot, ['.next/**/*']);

    // Turn off @next/next/no-html-link-for-pages since there is an issue with nextjs throwing linting errors
    // TODO(nicholas): remove after Vercel updates nextjs linter to only lint ["*.ts", "*.tsx", "*.js", "*.jsx"]
    addOverrideToLintConfig(host, options.appProjectRoot, {
      files: ['*.*'],
      rules: {
        '@next/next/no-html-link-for-pages': 'off',
      },
    });
    addOverrideToLintConfig(host, options.appProjectRoot, {
      files: ['*.spec.ts', '*.spec.tsx', '*.spec.js', '*.spec.jsx'],
      env: {
        jest: true,
      },
    });

    updateJson(
      host,
      joinPathFragments(options.appProjectRoot, '.eslintrc.json'),
      (json) => {
        // Find the override that handles both TS and JS files.
        const commonOverride = json.overrides?.find((o) =>
          ['*.ts', '*.tsx', '*.js', '*.jsx'].every((ext) =>
            o.files.includes(ext)
          )
        );
        if (commonOverride) {
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
