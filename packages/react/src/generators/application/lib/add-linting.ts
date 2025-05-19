import {
  type Tree,
  type GeneratorCallback,
  joinPathFragments,
  ensurePackage,
  readJson,
} from '@nx/devkit';
import { lintProjectGenerator } from '@nx/eslint';
import {
  addExtendsToLintConfig,
  addOverrideToLintConfig,
  addPredefinedConfigToFlatLintConfig,
  isEslintConfigSupported,
} from '@nx/eslint/src/generators/utils/eslint-file';
import { useFlatConfig } from '@nx/eslint/src/utils/flat-config';
import { addDependenciesToPackageJson, runTasksInSerial } from '@nx/devkit';
import { addSwcDependencies } from '@nx/js/src/utils/swc/add-swc-dependencies';
import { extraEslintDependencies } from '../../../utils/lint';
import { NormalizedSchema } from '../schema';
import { nxVersion } from '../../../utils/versions';

export async function addLinting(host: Tree, options: NormalizedSchema) {
  const tasks: GeneratorCallback[] = [];
  if (options.linter === 'eslint') {
    const lintTask = await lintProjectGenerator(host, {
      linter: options.linter,
      project: options.projectName,
      tsConfigPaths: [
        joinPathFragments(options.appProjectRoot, 'tsconfig.app.json'),
      ],
      unitTestRunner: options.unitTestRunner,
      skipFormat: true,
      rootProject: options.rootProject,
      skipPackageJson: options.skipPackageJson,
      addPlugin: options.addPlugin,
    });
    tasks.push(lintTask);

    if (isEslintConfigSupported(host)) {
      if (useFlatConfig(host)) {
        addPredefinedConfigToFlatLintConfig(
          host,
          options.appProjectRoot,
          'flat/react'
        );
        // Add an empty rules object to users know how to add/override rules
        addOverrideToLintConfig(host, options.appProjectRoot, {
          files: ['*.ts', '*.tsx', '*.js', '*.jsx'],
          rules: {},
        });
      } else {
        const addExtendsTask = addExtendsToLintConfig(
          host,
          options.appProjectRoot,
          { name: 'plugin:@nx/react', needCompatFixup: true }
        );
        tasks.push(addExtendsTask);
      }
    }

    if (!options.skipPackageJson) {
      const installTask = addDependenciesToPackageJson(
        host,
        extraEslintDependencies.dependencies,
        extraEslintDependencies.devDependencies
      );
      const addSwcTask = addSwcDependencies(host);
      tasks.push(installTask, addSwcTask);
    }
    if (options.useReactRouter) {
      await ignoreReactRouterFilesInEslintConfig(host, options.appProjectRoot);
    }
  }
  return runTasksInSerial(...tasks);
}

async function ignoreReactRouterFilesInEslintConfig(
  tree: Tree,
  projectRoot: string | undefined
): Promise<void> {
  if (!isEslintInstalled(tree)) {
    return;
  }

  ensurePackage('@nx/eslint', nxVersion);
  const { addIgnoresToLintConfig, isEslintConfigSupported } = await import(
    '@nx/eslint/src/generators/utils/eslint-file'
  );
  if (!isEslintConfigSupported(tree)) {
    return;
  }

  const { useFlatConfig } = await import('@nx/eslint/src/utils/flat-config');
  const isUsingFlatConfig = useFlatConfig(tree);
  if (!projectRoot && !isUsingFlatConfig) {
    // root eslintrc files ignore all files and the root eslintrc files add
    // back all the project files, so we only add the ignores to the project
    // eslintrc files
    return;
  }

  // for flat config, we update the root config file
  const directory = isUsingFlatConfig ? '' : projectRoot ?? '';

  addIgnoresToLintConfig(tree, directory, ['**/build', '**/.react-router']);
}

export function isEslintInstalled(tree: Tree): boolean {
  try {
    require('eslint');
    return true;
  } catch {}

  // it might not be installed yet, but it might be in the tree pending install
  const { devDependencies, dependencies } = tree.exists('package.json')
    ? readJson(tree, 'package.json')
    : {};

  return !!devDependencies?.['eslint'] || !!dependencies?.['eslint'];
}
