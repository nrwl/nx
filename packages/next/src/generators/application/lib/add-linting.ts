import { lintProjectGenerator } from '@nx/eslint';
import {
  addDependenciesToPackageJson,
  GeneratorCallback,
  joinPathFragments,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { extraEslintDependencies } from '@nx/react';
import { NormalizedSchema } from './normalize-options';
import {
  addExtendsToLintConfig,
  addIgnoresToLintConfig,
  addPluginsToLintConfig,
  addPredefinedConfigToFlatLintConfig,
  isEslintConfigSupported,
  updateOverrideInLintConfig,
  useFlatConfig,
  addImportToFlatConfig,
} from '@nx/eslint/internal';
import {
  getEslintConfigNextDependenciesVersionsToInstall,
  isNext16,
} from '../../../utils/version-utils';

export async function addLinting(
  host: Tree,
  options: NormalizedSchema
): Promise<GeneratorCallback> {
  if (options.linter !== 'eslint') return () => {};

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
      enableTypedLinting: options.enableTypedLinting,
      setParserOptionsProject: options.setParserOptionsProject,
      addPlugin: options.addPlugin,
    })
  );

  if (options.linter === 'eslint' && isEslintConfigSupported(host)) {
    if (useFlatConfig(host)) {
      addPredefinedConfigToFlatLintConfig(
        host,
        options.appProjectRoot,
        'flat/react-typescript',
        { checkBaseConfig: true }
      );
      if (await isNext16(host)) {
        addPluginsToLintConfig(host, options.appProjectRoot, ['@next/next']);
      } else {
        // Since Next.js < 16 does not support flat configs yet, we need to use compat fixup.
        const addExtendsTask = addExtendsToLintConfig(
          host,
          options.appProjectRoot,
          [
            { name: 'next', needCompatFixup: true },
            {
              name: 'next/core-web-vitals',
              needCompatFixup: true,
            },
          ]
        );
        tasks.push(addExtendsTask);
      }
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
    addIgnoresToLintConfig(host, options.appProjectRoot, [
      '.next/**/*',
      ...(options.isTsSolutionSetup ? ['**/out-tsc'] : []),
    ]);
  }

  if (!options.skipPackageJson) {
    const eslintConfigNextVersion =
      await getEslintConfigNextDependenciesVersionsToInstall(host);

    tasks.push(
      addDependenciesToPackageJson(
        host,
        extraEslintDependencies.dependencies,
        {
          ...extraEslintDependencies.devDependencies,
          'eslint-config-next': eslintConfigNextVersion,
          '@next/eslint-plugin-next': eslintConfigNextVersion,
        },
        undefined,
        true
      )
    );
  }

  return runTasksInSerial(...tasks);
}
