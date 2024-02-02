import { Linter, lintProjectGenerator } from '@nx/eslint';
import {
  addDependenciesToPackageJson,
  GeneratorCallback,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { extraEslintDependencies } from '@nx/react/src/utils/lint';
import {
  addExtendsToLintConfig,
  addIgnoresToLintConfig,
  isEslintConfigSupported,
} from '@nx/eslint/src/generators/utils/eslint-file';

interface NormalizedSchema {
  linter?: Linter;
  projectName: string;
  projectRoot: string;
  setParserOptionsProject?: boolean;
  tsConfigPaths: string[];
  skipPackageJson?: boolean;
  addPlugin?: boolean;
}

export async function addLinting(host: Tree, options: NormalizedSchema) {
  if (options.linter === Linter.None) {
    return () => {};
  }
  const tasks: GeneratorCallback[] = [];

  const lintTask = await lintProjectGenerator(host, {
    linter: options.linter,
    project: options.projectName,
    tsConfigPaths: options.tsConfigPaths,
    skipFormat: true,
    skipPackageJson: options.skipPackageJson,
    addPlugin: options.addPlugin,
  });

  tasks.push(lintTask);

  if (isEslintConfigSupported(host)) {
    addExtendsToLintConfig(host, options.projectRoot, 'plugin:@nx/react');
    addIgnoresToLintConfig(host, options.projectRoot, [
      '.expo',
      'web-build',
      'cache',
      'dist',
    ]);
  }

  if (!options.skipPackageJson) {
    const installTask = await addDependenciesToPackageJson(
      host,
      extraEslintDependencies.dependencies,
      extraEslintDependencies.devDependencies
    );
    tasks.push(installTask);
  }

  return runTasksInSerial(...tasks);
}
