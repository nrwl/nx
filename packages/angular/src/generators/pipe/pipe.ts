import type { Tree } from '@nx/devkit';
import {
  formatFiles,
  generateFiles,
  joinPathFragments,
  names,
} from '@nx/devkit';
import { addToNgModule, findModule } from '../utils';
import { normalizeOptions, validateOptions } from './lib';
import type { Schema } from './schema';

export async function pipeGenerator(tree: Tree, rawOptions: Schema) {
  validateOptions(tree, rawOptions);
  const options = normalizeOptions(tree, rawOptions);

  const pipeNames = names(options.name);

  generateFiles(
    tree,
    joinPathFragments(__dirname, 'files'),
    options.directory,
    {
      pipeClassName: pipeNames.className,
      pipeFileName: pipeNames.fileName,
      pipePropertyName: pipeNames.propertyName,
      standalone: options.standalone,
      tpl: '',
    }
  );

  if (options.skipTests) {
    const pathToSpecFile = joinPathFragments(
      options.directory,
      `${pipeNames.fileName}.pipe.spec.ts`
    );

    tree.delete(pathToSpecFile);
  }

  if (!options.skipImport && !options.standalone) {
    const modulePath = findModule(tree, options.path, options.module);
    addToNgModule(
      tree,
      options.path,
      modulePath,
      pipeNames.fileName,
      `${pipeNames.className}Pipe`,
      `${pipeNames.fileName}.pipe`,
      'declarations',
      options.flat,
      options.export
    );
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}

export default pipeGenerator;
