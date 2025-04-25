import type { Tree } from '@nx/devkit';
import type { NormalizedSchema } from './normalized-schema';
import addLintingGenerator from '../../add-linting/add-linting';

export async function addLinting(host: Tree, options: NormalizedSchema) {
  if (options.linter === 'none') {
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
    addPlugin: options.addPlugin,
  });
}
