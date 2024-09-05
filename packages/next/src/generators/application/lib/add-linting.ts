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
  addPredefinedConfigToFlatLintConfig,
  isEslintConfigSupported,
  updateOverrideInLintConfig,
} from '@nx/eslint/src/generators/utils/eslint-file';
import { eslintConfigNextVersion } from '../../../utils/versions';
import { useFlatConfig } from '@nx/eslint/src/utils/flat-config';

export async function addLinting(
  host: Tree,
  options: NormalizedSchema
): Promise<GeneratorCallback> {
  const tasks: GeneratorCallback[] = [];

  tasks.push(
    await lintProjectGenerator(host, {
      linter: options.linter,
      project: options.projectName,
      tsConfigPaths: [
        joinPathFragments(options.appProjectRoot, 'tsconfig.app.json'),
      ],
      unitTestRunner: options.unitTestRunner,
      skipFormat: true,
      rootProject: options.rootProject,
      setParserOptionsProject: options.setParserOptionsProject,
      addPlugin: options.addPlugin,
    })
  );

  if (options.linter === Linter.EsLint && isEslintConfigSupported(host)) {
    if (useFlatConfig(host)) {
      addPredefinedConfigToFlatLintConfig(
        host,
        options.appProjectRoot,
        'flat/react-typescript'
      );
      // Since Next.js does not support flat configs yet, we need to use compat fixup.
      const addExtendsTask = addExtendsToLintConfig(
        host,
        options.appProjectRoot,
        [
          { name: 'next', needCompatFixup: true },
          { name: 'next/core-web-vitals', needCompatFixup: true },
        ]
      );
      tasks.push(addExtendsTask);
    } else {
      const addExtendsTask = addExtendsToLintConfig(
        host,
        options.appProjectRoot,
        [
          'plugin:@nx/react-typescript',
          { name: 'next', needCompatFixup: true },
          { name: 'next/core-web-vitals', needCompatFixup: true },
        ]
      );
      tasks.push(addExtendsTask);
    }

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
    addIgnoresToLintConfig(host, options.appProjectRoot, ['.next/**/*']);
  }

  if (!options.skipPackageJson) {
    tasks.push(
      addDependenciesToPackageJson(host, extraEslintDependencies.dependencies, {
        ...extraEslintDependencies.devDependencies,
        'eslint-config-next': eslintConfigNextVersion,
      })
    );
  }

  return runTasksInSerial(...tasks);
}
