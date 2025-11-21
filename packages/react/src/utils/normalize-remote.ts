import { joinPathFragments, Tree } from '@nx/devkit';
import { determineProjectNameAndRootOptions } from '@nx/devkit/src/generators/project-name-and-root-utils';

export async function normalizeRemoteName(
  tree: Tree,
  remote: string,
  options: { directory: string }
) {
  const { projectName: remoteName } = await determineProjectNameAndRootOptions(
    tree,
    {
      name: remote,
      projectType: 'application',
      directory: options.directory,
    }
  );

  return remoteName;
}

export function normalizeRemoteDirectory(
  remote: string,
  options: { directory: string; appProjectRoot: string }
) {
  /**
   * With the `as-provided` format, the provided directory would be the root
   * of the host application. Append the remote name to the host parent
   * directory to get the remote directory.
   *
   * If no directory is provided, the remote directory will use the grandparent of the hostRoot 'acme/host/src' -> 'acme'
   */
  if (options.directory) {
    return joinPathFragments(options.directory, '..', remote);
  } else {
    return options.appProjectRoot === '.'
      ? remote
      : joinPathFragments(options.appProjectRoot, '..', remote);
  }
}
