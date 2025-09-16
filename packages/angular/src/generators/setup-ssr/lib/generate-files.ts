import type { Tree } from '@nx/devkit';
import {
  generateFiles,
  joinPathFragments,
  readProjectConfiguration,
} from '@nx/devkit';
import { getProjectSourceRoot } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { join } from 'path';
import { clean, coerce, gte } from 'semver';
import { getAppComponentInfo } from '../../utils/app-components-info';
import {
  getComponentType,
  getModuleTypeSeparator,
} from '../../utils/artifact-types';
import {
  getInstalledAngularVersionInfo,
  getInstalledPackageVersion,
} from '../../utils/version-utils';
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

  const { major: angularMajorVersion, version: angularVersion } =
    getInstalledAngularVersionInfo(tree);
  const baseFilesPath = join(__dirname, '..', 'files');
  let pathToFiles: string;
  if (angularMajorVersion >= 20) {
    pathToFiles = join(
      baseFilesPath,
      'v20+',
      options.isUsingApplicationBuilder
        ? 'application-builder'
        : 'server-builder',
      options.standalone ? 'standalone-src' : 'ngmodule-src'
    );
  } else if (angularMajorVersion === 19) {
    pathToFiles = join(
      baseFilesPath,
      'v19',
      options.isUsingApplicationBuilder
        ? 'application-builder'
        : 'server-builder',
      options.standalone ? 'standalone-src' : 'ngmodule-src'
    );
  } else {
    pathToFiles = join(
      baseFilesPath,
      'pre-v19',
      options.standalone ? 'standalone-src' : 'ngmodule-src'
    );
  }

  const sourceRoot = getProjectSourceRoot(project, tree);

  const ssrVersion = getInstalledPackageVersion(tree, '@angular/ssr');
  const cleanedSsrVersion = ssrVersion
    ? clean(ssrVersion) ?? coerce(ssrVersion).version
    : null;

  const componentType = getComponentType(tree);
  const appComponentInfo = getAppComponentInfo(
    tree,
    componentType ? `.${componentType}` : '',
    project
  );
  const moduleTypeSeparator = getModuleTypeSeparator(tree);
  const useBootstrapContext =
    // https://github.com/angular/angular-cli/releases/tag/20.3.0
    gte(angularVersion, '20.3.0') ||
    // https://github.com/angular/angular-cli/releases/tag/19.2.16
    (angularMajorVersion === 19 && gte(angularVersion, '19.2.16')) ||
    // https://github.com/angular/angular-cli/releases/tag/18.2.21
    (angularMajorVersion === 18 && gte(angularVersion, '18.2.21'));

  generateFiles(tree, pathToFiles, sourceRoot, {
    ...options,
    provideServerRoutingFn:
      !cleanedSsrVersion || gte(cleanedSsrVersion, '19.2.0')
        ? 'provideServerRouting'
        : 'provideServerRoutesConfig',
    appFileName: appComponentInfo.extensionlessFileName,
    appSymbolName: appComponentInfo.symbolName,
    moduleTypeSeparator,
    useBootstrapContext,
    tpl: '',
  });

  if (angularMajorVersion === 19 && !options.serverRouting) {
    tree.delete(joinPathFragments(sourceRoot, 'app/app.routes.server.ts'));
  }
}
