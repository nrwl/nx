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

export async function directiveGenerator(tree: Tree, schema: Schema) {
  validateOptions(tree, schema);
  const options = normalizeOptions(tree, schema);

  const directiveNames = names(options.name);

  generateFiles(
    tree,
    joinPathFragments(__dirname, 'files'),
    options.directory,
    {
      selector: options.selector,
      directiveClassName: directiveNames.className,
      directiveFileName: directiveNames.fileName,
      standalone: options.standalone,
      tpl: '',
    }
  );

  if (options.skipTests) {
    const pathToSpecFile = joinPathFragments(
      options.directory,
      `${directiveNames.fileName}.directive.spec.ts`
    );

    tree.delete(pathToSpecFile);
  }

  if (!options.skipImport && !options.standalone) {
    const modulePath = findModule(tree, options.path, options.module);
    addToNgModule(
      tree,
      options.path,
      modulePath,
      directiveNames.fileName,
      `${directiveNames.className}Directive`,
      `${directiveNames.fileName}.directive`,
      'declarations',
      options.flat,
      options.export
    );
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}

export default directiveGenerator;
