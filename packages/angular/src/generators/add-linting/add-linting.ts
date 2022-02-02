import type { GeneratorCallback, Tree } from '@nrwl/devkit';
import { formatFiles } from '@nrwl/devkit';
import { Linter, lintInitGenerator } from '@nrwl/linter';
import { addAngularEsLintDependencies } from './lib/add-angular-eslint-dependencies';
import { addProjectLintTarget } from './lib/add-project-lint-target';
import { createEsLintConfiguration } from './lib/create-eslint-configuration';
import type { AddLintingGeneratorSchema } from './schema';

export async function addLintingGenerator(
  tree: Tree,
  options: AddLintingGeneratorSchema
): Promise<GeneratorCallback> {
  const installTask = lintInitGenerator(tree, {
    linter: Linter.EsLint,
    skipPackageJson: options.skipPackageJson,
  });

  if (!options.skipPackageJson) {
    addAngularEsLintDependencies(tree);
  }

  createEsLintConfiguration(tree, options);
  addProjectLintTarget(tree, options);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return installTask;
}

export default addLintingGenerator;
