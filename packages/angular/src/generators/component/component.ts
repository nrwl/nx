import type { Tree } from '@nx/devkit';
import { formatFiles, generateFiles, joinPathFragments } from '@nx/devkit';
import { addToNgModule } from '../utils';
import { getInstalledAngularVersionInfo } from '../utils/version-utils';
import {
  exportComponentInEntryPoint,
  findModuleFromOptions,
  normalizeOptions,
  setGeneratorDefaults,
} from './lib';
import type { Schema } from './schema';

export async function componentGenerator(tree: Tree, rawOptions: Schema) {
  const options = await normalizeOptions(tree, rawOptions);

  const { major: angularMajorVersion } = getInstalledAngularVersionInfo(tree);
  generateFiles(
    tree,
    joinPathFragments(__dirname, 'files'),
    options.directory,
    {
      name: options.name,
      fileName: options.fileName,
      symbolName: options.symbolName,
      style: options.style,
      inlineStyle: options.inlineStyle,
      inlineTemplate: options.inlineTemplate,
      standalone: options.standalone,
      skipSelector: options.skipSelector,
      changeDetection: options.changeDetection,
      viewEncapsulation: options.viewEncapsulation,
      displayBlock: options.displayBlock,
      selector: options.selector,
      angularMajorVersion,
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

  if (options.inlineTemplate) {
    const pathToTemplateFile = joinPathFragments(
      options.directory,
      `${options.fileName}.html`
    );

    tree.delete(pathToTemplateFile);
  }

  if (options.style === 'none' || options.inlineStyle) {
    const pathToStyleFile = joinPathFragments(
      options.directory,
      `${options.fileName}.${options.style}`
    );

    tree.delete(pathToStyleFile);
  }

  if (!options.skipImport && !options.standalone) {
    const modulePath = findModuleFromOptions(
      tree,
      options,
      options.projectRoot
    );
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

  exportComponentInEntryPoint(tree, options);
  setGeneratorDefaults(tree, options);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}

export default componentGenerator;
