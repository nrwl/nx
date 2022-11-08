import { Remotes } from './models';
import { extname } from 'path';

export function mapRemotes(
  remotes: Remotes,
  remoteEntryExt: 'js' | 'mjs',
  determineRemoteUrl: (remote: string) => string
): Record<string, string> {
  const mappedRemotes = {};

  for (const remote of remotes) {
    if (Array.isArray(remote)) {
      const [remoteName, remoteLocation] = remote;
      const remoteLocationExt = extname(remoteLocation);
      mappedRemotes[remoteName] = ['.js', '.mjs'].includes(remoteLocationExt)
        ? remoteLocation
        : `${
            remoteLocation.endsWith('/')
              ? remoteLocation.slice(0, -1)
              : remoteLocation
          }/remoteEntry.${remoteEntryExt}`;
    } else if (typeof remote === 'string') {
      mappedRemotes[remote] = determineRemoteUrl(remote);
    }
  }

  return mappedRemotes;
}
