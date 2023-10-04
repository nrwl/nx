import type { Tree } from '@nx/devkit';
import { stripIndents } from '@nx/devkit';
import {
  validateProject,
  validateStandaloneOption,
} from '../../utils/validations';
import type { Schema } from '../schema';
import { getInstalledAngularVersionInfo } from '../../utils/version-utils';
import { lt } from 'semver';

export function validateOptions(tree: Tree, options: Schema): void {
  validateProject(tree, options.project);
  validateStandaloneOption(tree, options.standalone);
  validateHydrationOption(tree, options.hydration);
}

function validateHydrationOption(tree: Tree, hydration: boolean): void {
  if (!hydration) {
    return;
  }

  const installedAngularVersion = getInstalledAngularVersionInfo(tree).version;

  if (lt(installedAngularVersion, '16.0.0')) {
    throw new Error(stripIndents`The "hydration" option is only supported in Angular >= 16.0.0. You are currently using "${installedAngularVersion}".
    You can resolve this error by removing the "hydration" option or by migrating to Angular 16.0.0.`);
  }
}
