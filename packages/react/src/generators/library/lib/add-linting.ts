import { Tree } from 'nx/src/generators/tree';
import { Linter, lintProjectGenerator } from '@nx/eslint';
import { joinPathFragments } from 'nx/src/utils/path';
import {
  addDependenciesToPackageJson,
  GeneratorCallback,
  runTasksInSerial,
} from '@nx/devkit';

import { NormalizedSchema } from '../schema';
import { extraEslintDependencies } from '../../../utils/lint';
import {
  addExtendsToLintConfig,
  isEslintConfigSupported,
} from '@nx/eslint/src/generators/utils/eslint-file';

export async function addLinting(host: Tree, options: NormalizedSchema) {
  if (options.linter === Linter.EsLint) {
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
      const addExtendsTask = addExtendsToLintConfig(
        host,
        options.projectRoot,
        'plugin:@nx/react'
      );
      tasks.push(addExtendsTask);
    }

    let installTask = () => {};
    if (!options.skipPackageJson) {
      installTask = addDependenciesToPackageJson(
        host,
        extraEslintDependencies.dependencies,
        extraEslintDependencies.devDependencies
      );
      tasks.push(installTask);
    }

    return runTasksInSerial(...tasks);
  } else {
    return () => {};
  }
}
