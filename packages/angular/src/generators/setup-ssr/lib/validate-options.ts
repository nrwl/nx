import type { Tree } from '@nx/devkit';
import { readProjectConfiguration, stripIndents } from '@nx/devkit';
import { validateProject as validateExistingProject } from '../../utils/validations';
import type { Schema } from '../schema';
import { getInstalledAngularVersionInfo } from '../../utils/version-utils';
import { lt } from 'semver';

export function validateOptions(tree: Tree, options: Schema): void {
  validateProject(tree, options.project);
  validateBuildTarget(tree, options.project);
  validateHydrationOption(tree, options.hydration);
}

function validateProject(tree: Tree, project: string): void {
  validateExistingProject(tree, project);

  const { projectType } = readProjectConfiguration(tree, project);
  if (projectType !== 'application') {
    throw new Error(
      `The "${project}" project is not an application. Only application projects are supported by the "setup-ssr" generator.`
    );
  }
}

function validateBuildTarget(tree: Tree, project: string): void {
  const { targets } = readProjectConfiguration(tree, project);

  if (!targets?.build) {
    throw new Error(
      `The "${project}" project does not have a "build" target. Please add a "build" target.`
    );
  }
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
