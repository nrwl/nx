import { Tree } from 'nx/src/generators/tree';
import { lintProjectGenerator, Linter } from '@nx/eslint';
import { joinPathFragments } from 'nx/src/utils/path';
import {
  GeneratorCallback,
  addDependenciesToPackageJson,
  runTasksInSerial,
  updateJson,
} from '@nx/devkit';
import { extendNuxtEslintJson, extraEslintDependencies } from './lint';
import { editEslintConfigFiles } from '@nx/vue';

export async function addLinting(
  host: Tree,
  options: {
    linter: Linter;
    projectName: string;
    projectRoot: string;
    unitTestRunner?: 'vitest' | 'none';
    rootProject?: boolean;
  }
) {
  const tasks: GeneratorCallback[] = [];
  if (options.linter === 'eslint') {
    const lintTask = await lintProjectGenerator(host, {
      linter: options.linter,
      project: options.projectName,
      tsConfigPaths: [joinPathFragments(options.projectRoot, 'tsconfig.json')],
      unitTestRunner: options.unitTestRunner,
      eslintFilePatterns: [`${options.projectRoot}/**/*.{ts,tsx,js,jsx,vue}`],
      skipFormat: true,
      rootProject: options.rootProject,
    });
    tasks.push(lintTask);

    updateJson(
      host,
      joinPathFragments(options.projectRoot, '.eslintrc.json'),
      extendNuxtEslintJson
    );

    editEslintConfigFiles(host, options.projectRoot, options.rootProject);

    const installTask = addDependenciesToPackageJson(
      host,
      extraEslintDependencies.dependencies,
      {
        ...extraEslintDependencies.devDependencies,
      }
    );
    tasks.push(installTask);
  }
  return runTasksInSerial(...tasks);
}
