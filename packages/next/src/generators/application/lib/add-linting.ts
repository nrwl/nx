import {
  addDependenciesToPackageJson,
  detectPackageManager,
  GeneratorCallback,
  joinPathFragments,
  logger,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import {
  acknowledgeBuildScripts,
  getResolvedPackageVersion,
} from '@nx/devkit/internal';
import { major } from 'semver';
import { addExtraEslintDependencies } from '@nx/react/internal';
import { NormalizedSchema } from './normalize-options';
import {
  addExtendsToLintConfig,
  addIgnoresToLintConfig,
  addPluginConfigToFlatLintConfig,
  addPredefinedConfigToFlatLintConfig,
  addSpreadConfigToFlatLintConfig,
  isEslintConfigSupported,
  updateOverrideInLintConfig,
  useFlatConfig,
} from '@nx/eslint/internal';
import {
  findRootConfigWithConflictingPlugin,
  getEslintMajorVersion,
} from '../../../utils/eslint-config-next-conflicts';
import {
  getEslintConfigNextDependenciesVersionsToInstall,
  isNext16,
} from '../../../utils/version-utils';
import { eslintConfigNext15Version } from '../../../utils/versions';
import { addLintingToProject } from '@nx/js/internal';

export async function addLinting(
  host: Tree,
  options: NormalizedSchema
): Promise<GeneratorCallback> {
  const tasks: GeneratorCallback[] = [];
  const isNext16App = options.linter === 'eslint' && (await isNext16(host));

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
      enableTypedLinting: options.enableTypedLinting,
      skipPackageJson: options.skipPackageJson,
    })
  );

  // Everything below configures ESLint — predefined configs, `extends`, ignore
  // entries — which have no equivalent in other linters.

  let usesFlatNextConfigs = isNext16App;
  if (options.linter === 'eslint' && isEslintConfigSupported(host)) {
    if (useFlatConfig(host)) {
      if (isNext16App) {
        const rootConfigWithConflictingPlugin =
          findRootConfigWithConflictingPlugin(
            host,
            getEslintMajorVersion(host)
          );
        if (rootConfigWithConflictingPlugin) {
          // ESLint rejects eslint-config-next's own copies of React plugins the root
          // config already registers, so add only the Next.js plugin and its rules.
          if (
            declaresNextEslintPackageBelow16(host, '@next/eslint-plugin-next')
          ) {
            // Generators keep a declared version, and the plugin's flat
            // `configs['core-web-vitals']` starts in v16.
            tasks.push(
              addExtendsToLintConfig(host, options.appProjectRoot, {
                name: 'plugin:@next/next/core-web-vitals',
                needCompatFixup: true,
              })
            );
          } else {
            addPluginConfigToFlatLintConfig(
              host,
              options.appProjectRoot,
              'nextEslintPluginNext',
              '@next/eslint-plugin-next',
              'core-web-vitals',
              { insertAtTheEnd: false }
            );
          }
          logger.warn(
            `The ESLint config of the "${options.projectName}" project uses the "core-web-vitals" config of @next/eslint-plugin-next instead of eslint-config-next. ` +
              `The root config ${rootConfigWithConflictingPlugin} registers react, react-hooks, import or jsx-a11y, which eslint-config-next also registers, and ESLint fails when two configs register different copies of one plugin. ` +
              'The two may be the same copy, which ESLint accepts. To check, spread eslint-config-next/core-web-vitals in place of the "core-web-vitals" config and run lint. Keep the spread if lint reports no "Cannot redefine plugin" error. ' +
              `Otherwise, files that ${rootConfigWithConflictingPlugin} does not lint with those plugins get no React, React Hooks, jsx-a11y or import rules.`
          );
        } else {
          // Generators keep a declared version, which can predate v16.
          usesFlatNextConfigs = !declaresNextEslintPackageBelow16(
            host,
            'eslint-config-next'
          );
          if (usesFlatNextConfigs) {
            addSpreadConfigToFlatLintConfig(
              host,
              options.appProjectRoot,
              'nextVitals',
              'eslint-config-next/core-web-vitals',
              { insertAtTheEnd: false }
            );
          }
        }
      }
      addPredefinedConfigToFlatLintConfig(
        host,
        options.appProjectRoot,
        'flat/react-typescript',
        { checkBaseConfig: true }
      );
      if (!usesFlatNextConfigs) {
        // eslint-config-next < 16 has no flat config, so load it through FlatCompat.
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
    // A Next.js 16 app on the FlatCompat config needs the v15 packages that
    // Next.js 15 apps get.
    const eslintConfigNextVersion =
      isNext16App && !usesFlatNextConfigs
        ? eslintConfigNext15Version
        : await getEslintConfigNextDependenciesVersionsToInstall(host);

    // eslint-config-next pulls in unrs-resolver via
    // eslint-import-resolver-typescript, whose postinstall only fetches a
    // fallback binding for platforms its prebuilt optional dependencies miss.
    acknowledgeBuildScripts(host, detectPackageManager(host.root), {
      'unrs-resolver': false,
    });

    const nextLintDependencies = {
      'eslint-config-next': eslintConfigNextVersion,
      '@next/eslint-plugin-next': eslintConfigNextVersion,
    };
    // eslint-config-next 16 brings its own React plugins.
    tasks.push(
      usesFlatNextConfigs
        ? addDependenciesToPackageJson(
            host,
            {},
            nextLintDependencies,
            undefined,
            true
          )
        : addExtraEslintDependencies(host, nextLintDependencies)
    );
  }

  return runTasksInSerial(...tasks);
}

function declaresNextEslintPackageBelow16(
  tree: Tree,
  packageName: string
): boolean {
  const version = getResolvedPackageVersion(tree, packageName);
  return !!version && major(version) < 16;
}
