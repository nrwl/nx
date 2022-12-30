import type { Tree } from '@nrwl/devkit';
import { readProjectConfiguration } from '@nrwl/devkit';
import type { Schema } from '../schema';

export function getRemotesWithPorts(host: Tree, options: Schema) {
  // If type is host and remotes supplied, check remotes exist
  const remotesWithPort: { remoteName: string; port: number }[] = [];
  if (
    options.mfType === 'host' &&
    Array.isArray(options.remotes) &&
    options.remotes.length > 0
  ) {
    for (const remote of options.remotes) {
      const remoteConfig = readProjectConfiguration(host, remote);
      remotesWithPort.push({
        remoteName: remote,
        port: remoteConfig.targets['serve']?.options?.port ?? 4200,
      });
    }
  }
  return remotesWithPort;
}
