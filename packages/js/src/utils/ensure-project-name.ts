import {
  determineProjectNameAndRootOptions,
  ProjectGenerationOptions,
} from '@nx/devkit/src/generators/project-name-and-root-utils';
import type { Tree } from '@nx/devkit';

export async function ensureProjectName(
  tree: Tree,
  options: Omit<ProjectGenerationOptions, 'projectType'>,
  projectType: 'application' | 'library'
): Promise<void> {
  if (!options.name) {
    const { projectName } = await determineProjectNameAndRootOptions(tree, {
      ...options,
      projectType,
    });
    options.name = projectName;
  }
}
