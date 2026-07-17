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
  addOverrideToLintConfig,
  addPredefinedConfigToFlatLintConfig,
  isEslintConfigSupported,
  useFlatConfig,
} from '@nx/eslint/internal';

export async function addLinting(host: Tree, options: NormalizedSchema) {
  if (options.linter === 'none') {
    return () => {};
  }

  const tasks: GeneratorCallback[] = [];
  const lintTask = await lintProjectGenerator(host, {
    linter: options.linter,
    project: options.e2eProjectName,
    tsConfigPaths: [
      joinPathFragments(options.e2eProjectRoot, 'tsconfig.app.json'),
    ],
    skipFormat: true,
    addPlugin: options.addPlugin,
  });
  tasks.push(lintTask);

  if (isEslintConfigSupported(host)) {
    if (useFlatConfig(host)) {
      addPredefinedConfigToFlatLintConfig(
        host,
        options.e2eProjectRoot,
        'flat/react',
        { checkBaseConfig: true }
      );
      // Add an empty rules object to users know how to add/override rules
      addOverrideToLintConfig(host, options.e2eProjectRoot, {
        files: ['*.ts', '*.tsx', '*.js', '*.jsx'],
        rules: {},
      });
    } else {
      const addExtendsTask = addExtendsToLintConfig(
        host,
        options.e2eProjectRoot,
        { name: 'plugin:@nx/react', needCompatFixup: true }
      );
      tasks.push(addExtendsTask);
    }
  }

  const installTask = addDependenciesToPackageJson(
    host,
    extraEslintDependencies.dependencies,
    extraEslintDependencies.devDependencies,
    undefined,
    true
  );
  tasks.push(installTask);

  return runTasksInSerial(...tasks);
}
