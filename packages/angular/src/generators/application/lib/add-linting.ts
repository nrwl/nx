import type { Tree } from '@nrwl/devkit';
import type { NormalizedSchema } from './normalized-schema';

import { Linter } from '@nrwl/linter';
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
  });
}
