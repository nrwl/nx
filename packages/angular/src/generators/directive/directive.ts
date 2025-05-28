import type { Tree } from '@nx/devkit';
import { formatFiles, generateFiles, joinPathFragments } from '@nx/devkit';
import { addToNgModule, findModule } from '../utils';
import { getInstalledAngularVersionInfo } from '../utils/version-utils';
import { normalizeOptions } from './lib';
import type { Schema } from './schema';

export async function directiveGenerator(tree: Tree, schema: Schema) {
  const options = await normalizeOptions(tree, schema);

  const { major: angularMajorVersion } = getInstalledAngularVersionInfo(tree);

  generateFiles(
    tree,
    joinPathFragments(__dirname, 'files'),
    options.directory,
    {
      selector: options.selector,
      symbolName: options.symbolName,
      fileName: options.fileName,
      standalone: options.standalone,
      // Angular v19 or higher defaults to true, while lower versions default to false
      setStandalone:
        (angularMajorVersion >= 19 && !options.standalone) ||
        (angularMajorVersion < 19 && options.standalone),
      tpl: '',
    }
  );

  if (options.skipTests) {
    const pathToSpecFile = joinPathFragments(
      options.directory,
      `${options.fileName}.spec.ts`
    );

    tree.delete(pathToSpecFile);
  }

  if (!options.skipImport && !options.standalone) {
    const modulePath = findModule(tree, options.directory, options.module);
    addToNgModule(
      tree,
      options.directory,
      modulePath,
      options.name,
      options.symbolName,
      options.fileName,
      'declarations',
      true,
      options.export
    );
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}

export default directiveGenerator;
