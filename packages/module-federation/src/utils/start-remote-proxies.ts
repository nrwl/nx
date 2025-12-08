import { StaticRemotesConfig } from './parse-static-remotes-config';
import { createRemoteProxyServers, RemoteProxyConfig } from './proxy-server';

export function startRemoteProxies(
  staticRemotesConfig: StaticRemotesConfig,
  mappedLocationsOfRemotes: Record<string, string>,
  sslOptions?: { pathToCert: string; pathToKey: string }
) {
  // Build remote proxy config map
  const remotes: Record<string, RemoteProxyConfig> = {};
  for (const app of staticRemotesConfig.remotes) {
    remotes[app] = {
      target: mappedLocationsOfRemotes[app],
      port: staticRemotesConfig.config[app].port,
    };
  }

  createRemoteProxyServers(remotes, { sslOptions });
}
