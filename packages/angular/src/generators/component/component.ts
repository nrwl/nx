import type { Tree } from '@nrwl/devkit';
import {
  formatFiles,
  generateFiles,
  joinPathFragments,
  names,
} from '@nrwl/devkit';
import { addToNgModule } from '../utils';
import {
  exportComponentInEntryPoint,
  findModuleFromOptions,
  normalizeOptions,
  validateOptions,
} from './lib';
import type { Schema } from './schema';

export async function componentGenerator(tree: Tree, rawOptions: Schema) {
  validateOptions(tree, rawOptions);
  const options = normalizeOptions(tree, rawOptions);

  const pathToGenerate = options.flat
    ? joinPathFragments(__dirname, './files/__fileName__')
    : joinPathFragments(__dirname, './files');

  const componentNames = names(options.name);
  const typeNames = names(options.type);

  generateFiles(tree, pathToGenerate, options.path, {
    fileName: componentNames.fileName,
    className: componentNames.className,
    type: typeNames.fileName,
    typeClassName: typeNames.className,
    style: options.style,
    inlineStyle: options.inlineStyle,
    inlineTemplate: options.inlineTemplate,
    standalone: options.standalone,
    skipSelector: options.skipSelector,
    changeDetection: options.changeDetection,
    viewEncapsulation: options.viewEncapsulation,
    displayBlock: options.displayBlock,
    selector: options.selector,
    tpl: '',
  });

  if (options.skipTests) {
    const pathToSpecFile = joinPathFragments(
      options.path,
      `${!options.flat ? `${componentNames.fileName}/` : ``}${
        componentNames.fileName
      }.${typeNames.fileName}.spec.ts`
    );

    tree.delete(pathToSpecFile);
  }

  if (options.inlineTemplate) {
    const pathToTemplateFile = joinPathFragments(
      options.path,
      `${!options.flat ? `${componentNames.fileName}/` : ``}${
        componentNames.fileName
      }.${typeNames.fileName}.html`
    );

    tree.delete(pathToTemplateFile);
  }

  if (options.inlineStyle) {
    const pathToStyleFile = joinPathFragments(
      options.path,
      `${!options.flat ? `${componentNames.fileName}/` : ``}${
        componentNames.fileName
      }.${typeNames.fileName}.${options.style}`
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
      options.path,
      modulePath,
      componentNames.fileName,
      `${componentNames.className}${typeNames.className}`,
      options.flat
        ? `${componentNames.fileName}.${typeNames.fileName}`
        : joinPathFragments(
            componentNames.fileName,
            `${componentNames.fileName}.${typeNames.fileName}`
          ),
      'declarations',
      options.flat,
      options.export
    );
  }

  exportComponentInEntryPoint(tree, options);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}

export default componentGenerator;
