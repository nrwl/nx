import { readCachedProjectConfiguration } from 'nx/src/project-graph/project-graph';

// Cache for parsed static remotes environment variable to avoid repeated JSON.parse calls
let cachedStaticRemotesFromEnv: Record<string, string> | undefined;
let cachedStaticRemotesEnvValue: string | undefined;

/**
 * Gets static remotes configuration from the NX_MF_DEV_SERVER_STATIC_REMOTES environment variable.
 * Results are cached to avoid repeated JSON.parse calls.
 */
export function getStaticRemotesFromEnv(): Record<string, string> | undefined {
  const currentEnvValue = process.env.NX_MF_DEV_SERVER_STATIC_REMOTES;
  // Only re-parse if the environment variable value has changed
  if (currentEnvValue !== cachedStaticRemotesEnvValue) {
    cachedStaticRemotesEnvValue = currentEnvValue;
    cachedStaticRemotesFromEnv = currentEnvValue
      ? JSON.parse(currentEnvValue)
      : undefined;
  }
  return cachedStaticRemotesFromEnv;
}

export interface RemoteUrlOptions {
  /** Whether this is for a server-side rendering remote */
  isServer?: boolean;
  /** The bundler being used ('webpack', 'rspack', or 'angular-rspack') */
  bundler?: 'webpack' | 'rspack' | 'angular-webpack' | 'angular-rspack';
}

/**
 * Creates a function that determines the remote URL for a given remote name.
 * This is a shared utility used by webpack, rspack, and angular module federation configs.
 *
 * @param options - Configuration options for URL determination
 * @returns A function that takes a remote name and returns its URL
 */
export function createRemoteUrlResolver(
  options: RemoteUrlOptions = {}
): (remote: string) => string {
  const { isServer = false, bundler = 'rspack' } = options;
  const target = 'serve';

  // Determine the remote entry file based on bundler and server mode
  let remoteEntry: string;
  if (isServer) {
    remoteEntry = 'server/remoteEntry.js';
  } else if (bundler === 'angular-webpack') {
    remoteEntry = 'remoteEntry.mjs';
  } else {
    remoteEntry = 'remoteEntry.js';
  }

  return function (remote: string): string {
    const mappedStaticRemotesFromEnv = getStaticRemotesFromEnv();
    if (mappedStaticRemotesFromEnv && mappedStaticRemotesFromEnv[remote]) {
      return `${mappedStaticRemotesFromEnv[remote]}/${remoteEntry}`;
    }

    let remoteConfiguration = null;
    try {
      remoteConfiguration = readCachedProjectConfiguration(remote);
    } catch (e) {
      throw new Error(
        `Cannot find remote "${remote}". Check that the remote name is correct in your module federation config file.\n`
      );
    }

    const serveTarget = remoteConfiguration?.targets?.[target];

    if (!serveTarget) {
      throw new Error(
        `Cannot automatically determine URL of remote (${remote}). Looked for property "host" in the project's "serve" target.\n` +
          `You can also use the tuple syntax in your config to configure your remotes. e.g. \`remotes: [['remote1', 'http://localhost:4201']]\``
      );
    }

    const host =
      serveTarget.options?.host ??
      `http${serveTarget.options.ssl ? 's' : ''}://localhost`;
    const port = serveTarget.options?.port ?? 4201;
    return `${
      host.endsWith('/') ? host.slice(0, -1) : host
    }:${port}/${remoteEntry}`;
  };
}
