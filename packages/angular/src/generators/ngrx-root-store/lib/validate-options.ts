import type { Tree } from '@nx/devkit';
import { getProjects, readProjectConfiguration } from '@nx/devkit';
import { Schema } from '../schema';
import {
  getInstalledAngularVersionInfo,
  getInstalledPackageVersionInfo,
} from '../../utils/version-utils';
import { getPkgVersionForAngularMajorVersion } from '../../../utils/version-utils';
import { coerce, lt, major } from 'semver';
import { isNgStandaloneApp } from '../../../utils/nx-devkit/ast-utils';

export function validateOptions(tree: Tree, options: Schema): void {
  if (!getProjects(tree).has(options.project)) {
    throw new Error(
      `Could not find project '${options.project}'. Please ensure the project name is correct and exists.`
    );
  }

  const project = readProjectConfiguration(tree, options.project);
  if (project.projectType !== 'application') {
    throw new Error(
      `NgRx Root Stores can only be added to applications, please ensure the project you use is an application.`
    );
  }

  if (!options.minimal && !options.name) {
    throw new Error(
      `If generating a global feature state with your root store, you must provide a name for it with '--name'.`
    );
  }

  const angularVersionInfo = getInstalledAngularVersionInfo(tree);
  const intendedNgRxVersionForAngularMajor =
    getPkgVersionForAngularMajorVersion(
      'ngrxVersion',
      angularVersionInfo.major
    );

  const ngrxMajorVersion =
    getInstalledPackageVersionInfo(tree, '@ngrx/store')?.major ??
    major(coerce(intendedNgRxVersionForAngularMajor));

  const isStandalone = isNgStandaloneApp(tree, options.project);

  if (lt(angularVersionInfo.version, '14.1.0') || ngrxMajorVersion < 15) {
    if (isStandalone) {
      throw new Error(
        `The provided project '${options.project}' is set up to use Standalone APIs, however your workspace is not configured to support Standalone APIs. ` +
          'Please make sure to provide a path to an "NgModule" where the state will be registered. '
      );
    }
  }
}
