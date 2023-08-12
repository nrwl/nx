import type { Tree } from '@nx/devkit';
import { joinPathFragments, names, generateFiles } from '@nx/devkit';
import { normalizeOptions, validateOptions } from './lib';
import type { Schema } from './schema';

export async function spectatorServiceGenerator(
  tree: Tree,
  rawOptions: Schema
) {
  validateOptions(tree, rawOptions);
  const options = normalizeOptions(tree, rawOptions);

  const serviceNames = names(options.name);

  generateFiles(
    tree,
    joinPathFragments(__dirname, 'files'),
    options.directory,
    {
      fileName: serviceNames.fileName,
      className: serviceNames.className,
      jest: options.jest,
      tpl: '',
    }
  );

  if (options.skipTests) {
    const pathToSpecFile = joinPathFragments(
      options.directory,
      `${serviceNames.fileName}.service.spec.ts`
    );

    tree.delete(pathToSpecFile);
  }
}

export default spectatorServiceGenerator;
