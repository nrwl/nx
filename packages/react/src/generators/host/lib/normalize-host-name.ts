import { Tree } from '@nx/devkit';
import { determineProjectNameAndRootOptions } from '@nx/devkit/src/generators/project-name-and-root-utils';

export async function normalizeHostName(
  tree: Tree,
  directory: string,
  name?: string
): Promise<string> {
  const { projectName } = await determineProjectNameAndRootOptions(tree, {
    name,
    directory,
    projectType: 'application',
  });
  return projectName;
}
