import { Linter, lintProjectGenerator } from '@nx/linter';
import {
  addDependenciesToPackageJson,
  GeneratorCallback,
  joinPathFragments,
  runTasksInSerial,
  Tree,
  updateJson,
} from '@nx/devkit';
import {
  extendReactEslintJson,
  extraEslintDependencies,
} from '@nx/react/src/utils/lint';
import type { Linter as ESLintLinter } from 'eslint';

interface NormalizedSchema {
  linter?: Linter;
  projectName: string;
  projectRoot: string;
  setParserOptionsProject?: boolean;
  tsConfigPaths: string[];
  skipPackageJson?: boolean;
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
    eslintFilePatterns: [`${options.projectRoot}/**/*.{ts,tsx,js,jsx}`],
    skipFormat: true,
    skipPackageJson: options.skipPackageJson,
  });

  tasks.push(lintTask);

  updateJson(
    host,
    joinPathFragments(options.projectRoot, '.eslintrc.json'),
    (json: ESLintLinter.Config) => {
      json = extendReactEslintJson(json);

      json.ignorePatterns = [
        ...json.ignorePatterns,
        'public',
        '.cache',
        'node_modules',
      ];

      return json;
    }
  );

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
