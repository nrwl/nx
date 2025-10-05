import type { Tree } from '@nx/devkit';
import {
  formatFiles,
  generateFiles,
  joinPathFragments,
  names,
} from '@nx/devkit';
import { addToNgModule, findModule } from '../utils';
import { getInstalledAngularVersionInfo } from '../utils/version-utils';
import { normalizeOptions } from './lib';
import type { Schema } from './schema';

export async function pipeGenerator(tree: Tree, rawOptions: Schema) {
  const options = await normalizeOptions(tree, rawOptions);

  const { major: angularMajorVersion } = getInstalledAngularVersionInfo(tree);
  const pipeNames = names(options.name);

  generateFiles(
    tree,
    joinPathFragments(__dirname, 'files'),
    options.directory,
    {
      symbolName: options.symbolName,
      fileName: options.fileName,
      selector: pipeNames.propertyName,
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

export default pipeGenerator;
