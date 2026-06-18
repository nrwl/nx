import { Tree } from 'nx/src/generators/tree';
import { lintProjectGenerator } from '@nx/eslint';
import { joinPathFragments } from 'nx/src/utils/path';
import {
  addDependenciesToPackageJson,
  GeneratorCallback,
  runTasksInSerial,
} from '@nx/devkit';

import { NormalizedSchema } from '../schema';
import { getExtraEslintDependencies } from '../../../utils/lint';
import {
  addExtendsToLintConfig,
  addIgnoresToLintConfig,
  addOverrideToLintConfig,
  addPredefinedConfigToFlatLintConfig,
  isEslintConfigSupported,
  useFlatConfig,
} from '@nx/eslint/internal';

export async function addLinting(host: Tree, options: NormalizedSchema) {
  if (options.linter === 'eslint') {
    const tasks: GeneratorCallback[] = [];
    const lintTask = await lintProjectGenerator(host, {
      linter: options.linter,
      project: options.name,
      tsConfigPaths: [
        joinPathFragments(options.projectRoot, 'tsconfig.lib.json'),
      ],
      unitTestRunner: options.unitTestRunner,
      skipFormat: true,
      skipPackageJson: options.skipPackageJson,
      setParserOptionsProject: options.setParserOptionsProject,
      addPlugin: options.addPlugin,
    });
    tasks.push(lintTask);

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

    let installTask = () => {};
    if (!options.skipPackageJson) {
      const eslintDependencies = getExtraEslintDependencies(host);
      installTask = addDependenciesToPackageJson(
        host,
        eslintDependencies.dependencies,
        eslintDependencies.devDependencies,
        undefined,
        true
      );
      tasks.push(installTask);
    }

    return runTasksInSerial(...tasks);
  } else {
    return () => {};
  }
}
