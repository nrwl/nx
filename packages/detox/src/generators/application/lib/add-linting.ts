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
  isTypedLintingEnabled,
  useFlatConfig,
} from '@nx/eslint/internal';
import { addLintingToProject } from '@nx/js';

export async function addLinting(host: Tree, options: NormalizedSchema) {
  // Everything below configures ESLint — predefined configs, `extends`,
  // ignore entries — which have no equivalent in other linters. They only
  // need the linter registering, which the helper handles (including `none`).
  if (options.linter && options.linter !== 'eslint') {
    return addLintingToProject(host, {
      linter: options.linter as any,
      project: options.e2eProjectName,
      addPlugin: options.addPlugin,
    });
  }

  const tasks: GeneratorCallback[] = [];
  const lintTask = await lintProjectGenerator(host, {
    linter: options.linter,
    project: options.e2eProjectName,
    tsConfigPaths: [
      joinPathFragments(options.e2eProjectRoot, 'tsconfig.app.json'),
    ],
    skipFormat: true,
    enableTypedLinting: isTypedLintingEnabled(options),
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
