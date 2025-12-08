import { StaticRemoteConfig } from '../../utils';
import {
  createRemoteProxyServers,
  RemoteProxyConfig,
} from '../../utils/proxy-server';

export function startRemoteProxies(
  staticRemotesConfig: Record<string, StaticRemoteConfig>,
  mappedLocationsOfRemotes: Record<string, string>,
  sslOptions?: {
    pathToCert: string;
    pathToKey: string;
  },
  isServer?: boolean
) {
  // Build remote proxy config map
  const remotes: Record<string, RemoteProxyConfig> = {};
  for (const app of Object.keys(staticRemotesConfig)) {
    remotes[app] = {
      target: mappedLocationsOfRemotes[app],
      port: staticRemotesConfig[app].port,
    };
  }

  createRemoteProxyServers(remotes, { sslOptions, isServer });
}
