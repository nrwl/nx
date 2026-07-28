import {
  type Tree,
  type GeneratorCallback,
  joinPathFragments,
  ensurePackage,
  readJson,
} from '@nx/devkit';
import {
  addExtendsToLintConfig,
  addOverrideToLintConfig,
  addPredefinedConfigToFlatLintConfig,
  isEslintConfigSupported,
  isTypedLintingEnabled,
  useFlatConfig,
} from '@nx/eslint/internal';
import { addDependenciesToPackageJson, runTasksInSerial } from '@nx/devkit';
import { addSwcDependencies } from '@nx/js/internal';
import { addLintingToProject } from '@nx/js';
import { extraEslintDependencies } from '../../../utils/lint';
import { NormalizedSchema } from '../schema';
import { nxVersion } from '../../../utils/versions';

export async function addLinting(host: Tree, options: NormalizedSchema) {
  if (options.linter === 'none') {
    return () => {};
  }

  const tasks: GeneratorCallback[] = [];
  tasks.push(
    await addLintingToProject(host, {
      linter: options.linter,
      project: options.projectName,
      tsConfigPaths: [
        joinPathFragments(options.appProjectRoot, 'tsconfig.app.json'),
      ],
      unitTestRunner: options.unitTestRunner,
      rootProject: options.rootProject,
      skipPackageJson: options.skipPackageJson,
      enableTypedLinting: isTypedLintingEnabled(options),
      addPlugin: options.addPlugin,
    })
  );

  // Predefined configs, `extends` and ignore entries are ESLint concepts with
  // no equivalent in other linters.
  if (options.linter === 'eslint') {
    if (isEslintConfigSupported(host)) {
      if (useFlatConfig(host)) {
        addPredefinedConfigToFlatLintConfig(
          host,
          options.appProjectRoot,
          'flat/react',
          { checkBaseConfig: true }
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
        extraEslintDependencies.devDependencies,
        undefined,
        true
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
  const {
    addIgnoresToLintConfig,
    isEslintConfigSupported,
    useFlatConfig,
  }: typeof import('@nx/eslint/internal') = require('@nx/eslint/internal');
  if (!isEslintConfigSupported(tree)) {
    return;
  }

  const isUsingFlatConfig = useFlatConfig(tree);
  if (!projectRoot && !isUsingFlatConfig) {
    // root eslintrc files ignore all files and the root eslintrc files add
    // back all the project files, so we only add the ignores to the project
    // eslintrc files
    return;
  }

  // for flat config, we update the root config file
  const directory = isUsingFlatConfig ? '' : (projectRoot ?? '');

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
