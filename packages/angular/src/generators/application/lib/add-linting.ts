import type { Tree } from '@nx/devkit';
import type { NormalizedSchema } from './normalized-schema';

import { Linter } from '@nx/linter';
import addLintingGenerator from '../../add-linting/add-linting';

export async function addLinting(host: Tree, options: NormalizedSchema) {
  if (options.linter === Linter.None) {
    return;
  }
  await addLintingGenerator(host, {
    projectName: options.name,
    projectRoot: options.appProjectRoot,
    prefix: options.prefix,
    setParserOptionsProject: options.setParserOptionsProject,
    skipPackageJson: options.skipPackageJson,
    unitTestRunner: options.unitTestRunner,
    skipFormat: true,
  });
}
