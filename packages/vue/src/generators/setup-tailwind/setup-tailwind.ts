import type { GeneratorCallback, Tree } from '@nx/devkit';
import {
  addDependenciesToPackageJson,
  formatFiles,
  generateFiles,
  readProjectConfiguration,
} from '@nx/devkit';

import {
  autoprefixerVersion,
  postcssVersion,
  tailwindcssVersion,
} from '../../utils/versions';
import type { SetupTailwindOptions } from './schema';
import { addTailwindStyleImports } from './lib/add-tailwind-style-imports';
import { join } from 'path';

export async function setupTailwindGenerator(
  tree: Tree,
  options: SetupTailwindOptions
): Promise<void | GeneratorCallback> {
  let installTask: GeneratorCallback | undefined = undefined;
  const project = readProjectConfiguration(tree, options.project);

  generateFiles(tree, join(__dirname, './files'), project.root, {});

  addTailwindStyleImports(tree, project, options);

  if (!options.skipPackageJson) {
    installTask = addDependenciesToPackageJson(
      tree,
      {},
      {
        autoprefixer: autoprefixerVersion,
        postcss: postcssVersion,
        tailwindcss: tailwindcssVersion,
      }
    );
  }

  if (!options.skipFormat) await formatFiles(tree);

  return installTask;
}

export default setupTailwindGenerator;
