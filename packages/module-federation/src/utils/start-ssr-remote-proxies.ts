import type { StaticRemotesConfig } from './parse-static-remotes-config';
import { createRemoteProxyServers, RemoteProxyConfig } from './proxy-server';

export function startSsrRemoteProxies(
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

  // SSR remotes have two output paths: one for the browser and one for the server.
  // The isServer flag enables path rewriting to handle both paths.
  createRemoteProxyServers(remotes, { sslOptions, isServer: true });
}
