import { Remotes } from './models';
import { extname } from 'path';

/**
 * Map remote names to a format that can be understood and used by Module
 * Federation.
 *
 * @param remotes - The remotes to map
 * @param remoteEntryExt - The file extension of the remoteEntry file
 * @param determineRemoteUrl - The function used to lookup the URL of the served remote
 */
export function mapRemotes(
  remotes: Remotes,
  remoteEntryExt: 'js' | 'mjs',
  determineRemoteUrl: (remote: string) => string,
  isRemoteGlobal = false
): Record<string, string> {
  const mappedRemotes = {};

  for (const remote of remotes) {
    if (Array.isArray(remote)) {
      const remoteName = normalizeRemoteName(remote[0]);
      mappedRemotes[remoteName] = handleArrayRemote(
        remote,
        remoteEntryExt,
        isRemoteGlobal
      );
    } else if (typeof remote === 'string') {
      const remoteName = normalizeRemoteName(remote);
      mappedRemotes[remoteName] = handleStringRemote(
        remoteName,
        determineRemoteUrl,
        isRemoteGlobal
      );
    }
  }

  return mappedRemotes;
}

// Helper function to deal with remotes that are arrays
function handleArrayRemote(
  remote: [string, string],
  remoteEntryExt: 'js' | 'mjs',
  isRemoteGlobal: boolean
): string {
  let [remoteName, remoteLocation] = remote;
  remoteName = normalizeRemoteName(remoteName);
  const remoteLocationExt = extname(remoteLocation);

  // If remote location already has .js or .mjs extension
  if (['.js', '.mjs'].includes(remoteLocationExt)) {
    return remoteLocation;
  }

  const baseRemote = remoteLocation.endsWith('/')
    ? remoteLocation.slice(0, -1)
    : remoteLocation;

  const globalPrefix = isRemoteGlobal
    ? `${remoteName.replace(/-/g, '_')}@`
    : '';

  // if the remote is defined with anything other than http then we assume it's a promise based remote
  // In that case we should use what the user provides as the remote location
  if (!remoteLocation.startsWith('promise new Promise')) {
    return `${globalPrefix}${baseRemote}/remoteEntry.${remoteEntryExt}`;
  } else {
    return remoteLocation;
  }
}

// Helper function to deal with remotes that are strings
function handleStringRemote(
  remote: string,
  determineRemoteUrl: (remote: string) => string,
  isRemoteGlobal: boolean
): string {
  const globalPrefix = isRemoteGlobal ? `${remote.replace(/-/g, '_')}@` : '';

  return `${globalPrefix}${determineRemoteUrl(remote)}`;
}

/**
 * Map remote names to a format that can be understood and used by Module
 * Federation.
 *
 * @param remotes - The remotes to map
 * @param remoteEntryExt - The file extension of the remoteEntry file
 * @param determineRemoteUrl - The function used to lookup the URL of the served remote
 */
export function mapRemotesForSSR(
  remotes: Remotes,
  remoteEntryExt: 'js' | 'mjs',
  determineRemoteUrl: (remote: string) => string
): Record<string, string> {
  const mappedRemotes = {};

  for (const remote of remotes) {
    if (Array.isArray(remote)) {
      let [remoteName, remoteLocation] = remote;
      remoteName = normalizeRemoteName(remoteName);
      const remoteLocationExt = extname(remoteLocation);
      mappedRemotes[remoteName] = `${remoteName}@${
        ['.js', '.mjs'].includes(remoteLocationExt)
          ? remoteLocation
          : `${
              remoteLocation.endsWith('/')
                ? remoteLocation.slice(0, -1)
                : remoteLocation
            }/remoteEntry.${remoteEntryExt}`
      }`;
    } else if (typeof remote === 'string') {
      const remoteName = normalizeRemoteName(remote);
      mappedRemotes[remoteName] = `${remoteName}@${determineRemoteUrl(remote)}`;
    }
  }

  return mappedRemotes;
}

function normalizeRemoteName(remote: string) {
  return remote.replace(/-/g, '_');
}
