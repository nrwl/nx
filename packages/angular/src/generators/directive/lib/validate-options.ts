import type { Tree } from '@nrwl/devkit';
import { getProjects, stripIndents } from '@nrwl/devkit';
import { lt } from 'semver';
import { checkPathUnderProjectRoot } from '../../utils/path';
import { getInstalledAngularVersionInfo } from '../../utils/version-utils';
import type { Schema } from '../schema';

export function validateOptions(tree: Tree, options: Schema): void {
  const projects = getProjects(tree);
  if (!projects.has(options.project)) {
    throw new Error(`Project "${options.project}" does not exist!`);
  }

  checkPathUnderProjectRoot(tree, options.project, options.path);

  const installedAngularVersionInfo = getInstalledAngularVersionInfo(tree);
  if (lt(installedAngularVersionInfo.version, '14.1.0') && options.standalone) {
    throw new Error(stripIndents`The "standalone" option is only supported in Angular >= 14.1.0. You are currently using "${installedAngularVersionInfo.version}".
    You can resolve this error by removing the "standalone" option or by migrating to Angular 14.1.0.`);
  }
}
