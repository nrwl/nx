import {
  addDependenciesToPackageJson,
  detectPackageManager,
  GeneratorCallback,
  joinPathFragments,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { acknowledgeBuildScripts } from '@nx/devkit/internal';
import { extraEslintDependencies } from '@nx/react';
import { NormalizedSchema } from './normalize-options';
import {
  addExtendsToLintConfig,
  addIgnoresToLintConfig,
  addPluginsToLintConfig,
  addPredefinedConfigToFlatLintConfig,
  isEslintConfigSupported,
  isTypedLintingEnabled,
  updateOverrideInLintConfig,
  useFlatConfig,
  addImportToFlatConfig,
} from '@nx/eslint/internal';
import {
  getEslintConfigNextDependenciesVersionsToInstall,
  isNext16,
} from '../../../utils/version-utils';
import { addLintingToProject } from '@nx/js/internal';

export async function addLinting(
  host: Tree,
  options: NormalizedSchema
): Promise<GeneratorCallback> {
  const tasks: GeneratorCallback[] = [];

  tasks.push(
    await addLintingToProject(host, {
      oxlintPlugins: ['nextjs', 'react', 'react-perf', 'jsx-a11y'],
      linter: options.linter,
      project: options.projectName,
      tsConfigPaths: [
        joinPathFragments(options.appProjectRoot, 'tsconfig.app.json'),
      ],
      unitTestRunner: options.unitTestRunner,
      rootProject: options.rootProject,
      enableTypedLinting: isTypedLintingEnabled(options),
      addPlugin: options.addPlugin,
      skipPackageJson: options.skipPackageJson,
    })
  );

  // Everything below configures ESLint — predefined configs, `extends`, ignore
  // entries — which have no equivalent in other linters.

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

  if (options.linter === 'eslint' && !options.skipPackageJson) {
    const eslintConfigNextVersion =
      await getEslintConfigNextDependenciesVersionsToInstall(host);

    // eslint-config-next pulls in unrs-resolver via
    // eslint-import-resolver-typescript, whose postinstall only fetches a
    // fallback binding for platforms its prebuilt optional dependencies miss.
    acknowledgeBuildScripts(host, detectPackageManager(host.root), {
      'unrs-resolver': false,
    });

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
