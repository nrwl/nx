import { join } from 'path';

import type { GeneratorCallback, Tree } from '@nx/devkit';
import {
  addDependenciesToPackageJson,
  formatFiles,
  generateFiles,
  readProjectConfiguration,
} from '@nx/devkit';

import {
  unocssVersion,
} from '../../utils/versions';

import type { SetupUnoCSSOptions } from './schema';
import {addUnoCSSStyleImports} from './lib/add-unocss-style-imports'

export async function setupUnoCSSGenerator(
  tree: Tree,
  options: SetupUnoCSSOptions
): Promise<void | GeneratorCallback> {
  let installTask: GeneratorCallback | undefined = undefined;
  const project = readProjectConfiguration(tree, options.project);

  generateFiles(tree, join(__dirname, './files'), project.root, {});

  addUnoCSSStyleImports(tree, project, options);

  if (!options.skipPackageJson) {
    installTask = addDependenciesToPackageJson(
      tree,
      {},
      {
        unocss: unocssVersion,
      }
    );
  }

  if (!options.skipFormat) await formatFiles(tree);

  return installTask;
}

export default setupUnoCSSGenerator;
