import { Tree } from 'nx/src/generators/tree';
import { Linter, lintProjectGenerator } from '@nx/linter';
import { joinPathFragments } from 'nx/src/utils/path';
import { addDependenciesToPackageJson, runTasksInSerial } from '@nx/devkit';
import { NormalizedSchema } from '../generators/library/schema';
import { extraEslintDependencies } from './lint';
import {
  addExtendsToLintConfig,
  isEslintConfigSupported,
} from '@nx/linter/src/generators/utils/eslint-file';

export async function addLinting(
  host: Tree,
  options: {
    linter: Linter;
    name: string;
    projectRoot: string;
    unitTestRunner?: 'jest' | 'vitest' | 'none';
    setParserOptionsProject?: boolean;
    skipPackageJson?: boolean;
  },
  projectType: 'lib' | 'app'
) {
  if (options.linter === Linter.EsLint) {
    const lintTask = await lintProjectGenerator(host, {
      linter: options.linter,
      project: options.name,
      tsConfigPaths: [
        joinPathFragments(options.projectRoot, `tsconfig.${projectType}.json`),
      ],
      unitTestRunner: options.unitTestRunner,
      eslintFilePatterns: [`${options.projectRoot}/**/*.{ts,tsx,js,jsx,vue}`],
      skipFormat: true,
      setParserOptionsProject: options.setParserOptionsProject,
    });

    if (isEslintConfigSupported(host)) {
      addExtendsToLintConfig(host, options.projectRoot, [
        'plugin:vue/vue3-essential',
        'eslint:recommended',
        '@vue/eslint-config-typescript',
        '@vue/eslint-config-prettier/skip-formatting',
      ]);
    }

    let installTask = () => {};
    if (!options.skipPackageJson) {
      installTask = addDependenciesToPackageJson(
        host,
        extraEslintDependencies.dependencies,
        extraEslintDependencies.devDependencies
      );
    }

    return runTasksInSerial(lintTask, installTask);
  } else {
    return () => {};
  }
}
