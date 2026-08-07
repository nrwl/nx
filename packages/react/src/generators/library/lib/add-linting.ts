import {
  addDependenciesToPackageJson,
  GeneratorCallback,
  runTasksInSerial,
  Tree,
  joinPathFragments,
} from '@nx/devkit';
import { addLintingToProject } from '@nx/js';

import { NormalizedSchema } from '../schema';
import { extraEslintDependencies } from '../../../utils/lint';
import {
  addExtendsToLintConfig,
  addIgnoresToLintConfig,
  addOverrideToLintConfig,
  addPredefinedConfigToFlatLintConfig,
  isEslintConfigSupported,
  isTypedLintingEnabled,
  useFlatConfig,
} from '@nx/eslint/internal';

export async function addLinting(host: Tree, options: NormalizedSchema) {
  if (options.linter === 'none') {
    return () => {};
  }

  const tasks: GeneratorCallback[] = [];
  tasks.push(
    await addLintingToProject(host, {
      oxlintPlugins: ['react', 'react-perf', 'jsx-a11y'],
      linter: options.linter,
      project: options.name,
      tsConfigPaths: [
        joinPathFragments(options.projectRoot, 'tsconfig.lib.json'),
      ],
      unitTestRunner: options.unitTestRunner,
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
          options.projectRoot,
          'flat/react',
          { checkBaseConfig: true }
        );
        // Add an empty rules object to users know how to add/override rules
        addOverrideToLintConfig(host, options.projectRoot, {
          files: ['*.ts', '*.tsx', '*.js', '*.jsx'],
          rules: {},
        });
      } else {
        const addExtendsTask = addExtendsToLintConfig(
          host,
          options.projectRoot,
          {
            name: 'plugin:@nx/react',
            needCompatFixup: true,
          }
        );
        tasks.push(addExtendsTask);
      }

      // Add out-tsc ignore pattern when using TS solution setup
      if (options.isUsingTsSolutionConfig) {
        addIgnoresToLintConfig(host, options.projectRoot, ['**/out-tsc']);
      }
    }

    if (!options.skipPackageJson) {
      tasks.push(
        addDependenciesToPackageJson(
          host,
          extraEslintDependencies.dependencies,
          extraEslintDependencies.devDependencies,
          undefined,
          true
        )
      );
    }
  }

  return runTasksInSerial(...tasks);
}
