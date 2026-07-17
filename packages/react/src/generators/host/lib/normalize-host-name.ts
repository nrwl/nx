import { Tree } from '@nx/devkit';
import { determineProjectNameAndRootOptions } from '@nx/devkit/internal';

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
