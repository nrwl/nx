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

  for (const nxRemoteProjectName of remotes) {
    if (Array.isArray(nxRemoteProjectName)) {
      const mfRemoteName = normalizeRemoteName(nxRemoteProjectName[0]);
      mappedRemotes[mfRemoteName] = handleArrayRemote(
        nxRemoteProjectName,
        remoteEntryExt,
        isRemoteGlobal
      );
    } else if (typeof nxRemoteProjectName === 'string') {
      const mfRemoteName = normalizeRemoteName(nxRemoteProjectName);
      mappedRemotes[mfRemoteName] = handleStringRemote(
        nxRemoteProjectName,

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
  let [nxRemoteProjectName, remoteLocation] = remote;
  const mfRemoteName = normalizeRemoteName(nxRemoteProjectName);
  const remoteLocationExt = extname(remoteLocation);

  // If remote location already has .js or .mjs extension
  if (['.js', '.mjs', '.json'].includes(remoteLocationExt)) {
    return remoteLocation;
  }

  const baseRemote = remoteLocation.endsWith('/')
    ? remoteLocation.slice(0, -1)
    : remoteLocation;

  const globalPrefix = isRemoteGlobal
    ? `${normalizeRemoteName(nxRemoteProjectName)}@`
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
  nxRemoteProjectName: string,
  determineRemoteUrl: (nxRemoteProjectName: string) => string,
  isRemoteGlobal: boolean
): string {
  const globalPrefix = isRemoteGlobal
    ? `${normalizeRemoteName(nxRemoteProjectName)}@`
    : '';

  return `${globalPrefix}${determineRemoteUrl(nxRemoteProjectName)}`;
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
      let [nxRemoteProjectName, remoteLocation] = remote;
      const mfRemoteName = normalizeRemoteName(nxRemoteProjectName);
      const remoteLocationExt = extname(remoteLocation);
      mappedRemotes[mfRemoteName] = `${mfRemoteName}@${
        ['.js', '.mjs', '.json'].includes(remoteLocationExt)
          ? remoteLocation
          : `${
              remoteLocation.endsWith('/')
                ? remoteLocation.slice(0, -1)
                : remoteLocation
            }/remoteEntry.${remoteEntryExt}`
      }`;
    } else if (typeof remote === 'string') {
      const mfRemoteName = normalizeRemoteName(remote);
      mappedRemotes[mfRemoteName] = `${mfRemoteName}@${determineRemoteUrl(
        remote
      )}`;
    }
  }

  return mappedRemotes;
}

function normalizeRemoteName(remote: string) {
  return remote.replace(/-/g, '_');
}
