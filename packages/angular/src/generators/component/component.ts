import type { Tree } from '@nrwl/devkit';
import {
  formatFiles,
  generateFiles,
  joinPathFragments,
  names,
  readNxJson,
  stripIndents,
} from '@nrwl/devkit';
import { lt } from 'semver';
import { checkPathUnderProjectRoot } from '../utils/path';
import { getInstalledAngularVersionInfo } from '../utils/version-utils';
import { exportComponentInEntryPoint } from './lib/component';
import { normalizeOptions } from './lib/normalize-options';
import type { Schema } from './schema';
import { addToNgModule } from '../utils';
import { findModuleFromOptions } from './lib/module';

export async function componentGenerator(tree: Tree, rawOptions: Schema) {
  const installedAngularVersionInfo = getInstalledAngularVersionInfo(tree);

  if (
    lt(installedAngularVersionInfo.version, '14.1.0') &&
    rawOptions.standalone
  ) {
    throw new Error(stripIndents`The "standalone" option is only supported in Angular >= 14.1.0. You are currently using ${installedAngularVersionInfo.version}.
    You can resolve this error by removing the "standalone" option or by migrating to Angular 14.1.0.`);
  }

  const options = await normalizeOptions(tree, rawOptions);

  checkPathUnderProjectRoot(tree, options.project, options.path);

  const pathToGenerate = options.flat
    ? joinPathFragments(__dirname, './files/__fileName__')
    : joinPathFragments(__dirname, './files');

  const componentNames = names(options.name);
  const typeNames = names(options.type);

  const selector =
    options.selector ||
    buildSelector(tree, componentNames.fileName, options.prefix);

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
    selector,
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

function buildSelector(tree: Tree, name: string, prefix: string) {
  const selectorPrefix = names(
    prefix ?? readNxJson(tree).npmScope ?? 'app'
  ).fileName;

  return names(`${selectorPrefix}-${name}`).fileName;
}

export default componentGenerator;
