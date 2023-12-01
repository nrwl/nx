import { Linter, lintProjectGenerator } from '@nx/eslint';
import {
  addDependenciesToPackageJson,
  GeneratorCallback,
  joinPathFragments,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { extraEslintDependencies } from '@nx/react/src/utils/lint';
import { NormalizedSchema } from './normalize-options';
import {
  addExtendsToLintConfig,
  addIgnoresToLintConfig,
  addOverrideToLintConfig,
  isEslintConfigSupported,
  updateOverrideInLintConfig,
} from '@nx/eslint/src/generators/utils/eslint-file';

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
    skipFormat: true,
    rootProject: options.rootProject,
  });
  if (options.linter === Linter.EsLint && isEslintConfigSupported(host)) {
    addExtendsToLintConfig(host, options.appProjectRoot, [
      'plugin:@nx/react-typescript',
      'next',
      'next/core-web-vitals',
    ]);

    // Turn off @next/next/no-html-link-for-pages since there is an issue with nextjs throwing linting errors
    // TODO(nicholas): remove after Vercel updates nextjs linter to only lint ["*.ts", "*.tsx", "*.js", "*.jsx"]
    addOverrideToLintConfig(
      host,
      options.appProjectRoot,
      {
        files: ['*.*'],
        rules: {
          '@next/next/no-html-link-for-pages': 'off',
        },
      },
      { insertAtTheEnd: false }
    );
    updateOverrideInLintConfig(
      host,
      options.appProjectRoot,
      (o) =>
        Array.isArray(o.files) &&
        o.files.some((f) => f.match(/\*\.ts$/)) &&
        o.files.some((f) => f.match(/\*\.tsx$/)) &&
        o.files.some((f) => f.match(/\*\.js$/)) &&
        o.files.some((f) => f.match(/\*\.jsx$/)),
      (o) => ({
        ...o,
        rules: {
          ...o.rules,
          '@next/next/no-html-link-for-pages': [
            'error',
            `${options.appProjectRoot}/pages`,
          ],
        },
      })
    );
    // add jest specific config
    if (options.unitTestRunner === 'jest') {
      addOverrideToLintConfig(host, options.appProjectRoot, {
        files: ['*.spec.ts', '*.spec.tsx', '*.spec.js', '*.spec.jsx'],
        env: {
          jest: true,
        },
      });
    }
    addIgnoresToLintConfig(host, options.appProjectRoot, ['.next/**/*']);
  }

  const installTask = addDependenciesToPackageJson(
    host,
    extraEslintDependencies.dependencies,
    extraEslintDependencies.devDependencies
  );

  return runTasksInSerial(lintTask, installTask);
}
