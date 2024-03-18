import { Tree, joinPathFragments } from '@nx/devkit';
import { determineProjectNameAndRootOptions } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { NormalizedSchema } from '../schema';

export async function normalizeRemoteName(
  tree: Tree,
  remote: string,
  options: NormalizedSchema
) {
  const { projectName: remoteName } = await determineProjectNameAndRootOptions(
    tree,
    {
      name: remote,
      projectType: 'application',
      directory: options.directory,
      projectNameAndRootFormat: options.projectNameAndRootFormat,
      callingGenerator: '@nx/react:host',
    }
  );

  return remoteName;
}

export function normalizeRemoteDirectory(
  remote: string,
  options: NormalizedSchema
) {
  if (options.projectNameAndRootFormat === 'derived' || !options.directory) {
    return options.directory;
  }

  /**
   * With the `as-provided` format, the provided directory would be the root
   * of the host application. Append the remote name to the host parent
   * directory to get the remote directory.
   */
  return joinPathFragments(options.directory, '..', remote);
}
