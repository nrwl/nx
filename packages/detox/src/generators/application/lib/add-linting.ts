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
import { addLintingToProject } from '@nx/js/internal';

export async function addLinting(host: Tree, options: NormalizedSchema) {
  const tasks: GeneratorCallback[] = [];
  tasks.push(
    await addLintingToProject(host, {
      linter: options.linter,
      project: options.e2eProjectName,
      tsConfigPaths: [
        joinPathFragments(options.e2eProjectRoot, 'tsconfig.app.json'),
      ],
      enableTypedLinting: isTypedLintingEnabled(options),
      addPlugin: options.addPlugin,
      // Detox e2e specs are Jest; this is what enables the linter's Jest rules.
      unitTestRunner: 'jest',
    })
  );

  // Everything below configures ESLint — predefined configs, `extends`, ignore
  // entries — which have no equivalent in other linters.
  if (options.linter && options.linter !== 'eslint') {
    return runTasksInSerial(...tasks);
  }

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
