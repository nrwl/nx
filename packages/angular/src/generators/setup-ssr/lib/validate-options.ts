import type { Tree } from '@nx/devkit';
import { readProjectConfiguration } from '@nx/devkit';
import { validateProject as validateExistingProject } from '../../utils/validations';
import { getInstalledAngularVersionInfo } from '../../utils/version-utils';
import type { Schema } from '../schema';

export function validateOptions(tree: Tree, options: Schema): void {
  validateProject(tree, options.project);
  validateBuildTarget(tree, options.project);

  const { major: angularMajorVersion, version: angularVersion } =
    getInstalledAngularVersionInfo(tree);
  if (angularMajorVersion !== 19 && options.serverRouting !== undefined) {
    throw new Error(
      `The "serverRouting" option is only supported in Angular versions 19.x.x. You are using Angular ${angularVersion}.`
    );
  }
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
