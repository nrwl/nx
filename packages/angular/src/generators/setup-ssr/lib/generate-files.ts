import type { Tree } from '@nx/devkit';
import { generateFiles, readProjectConfiguration } from '@nx/devkit';
import { getProjectSourceRoot } from '@nx/js/internal';
import { join } from 'path';
import { gte } from 'semver';
import { getAppComponentInfo } from '../../utils/app-components-info';
import {
  getComponentType,
  getModuleTypeSeparator,
} from '../../utils/artifact-types';
import { getInstalledAngularVersionInfo } from '../../utils/version-utils';
import type { NormalizedGeneratorOptions } from '../schema';

export function generateSSRFiles(
  tree: Tree,
  options: NormalizedGeneratorOptions
) {
  const project = readProjectConfiguration(tree, options.project);

  if (
    project.targets.server ||
    (options.isUsingApplicationBuilder &&
      project.targets.build.options?.server !== undefined)
  ) {
    // server has already been added
    return;
  }

  const { version: angularVersion } = getInstalledAngularVersionInfo(tree);
  const pathToFiles = join(
    __dirname,
    '..',
    'files',
    'v20+',
    options.isUsingApplicationBuilder
      ? 'application-builder'
      : 'server-builder',
    options.standalone ? 'standalone-src' : 'ngmodule-src'
  );

  const sourceRoot = getProjectSourceRoot(project, tree);

  const componentType = getComponentType(tree);
  const appComponentInfo = getAppComponentInfo(
    tree,
    componentType ? `.${componentType}` : '',
    project
  );
  const moduleTypeSeparator = getModuleTypeSeparator(tree);
  // https://github.com/angular/angular-cli/releases/tag/20.3.0
  const useBootstrapContext = gte(angularVersion, '20.3.0');

  generateFiles(tree, pathToFiles, sourceRoot, {
    ...options,
    appFileName: appComponentInfo.extensionlessFileName,
    appSymbolName: appComponentInfo.symbolName,
    moduleTypeSeparator,
    useBootstrapContext,
    tpl: '',
  });
}
