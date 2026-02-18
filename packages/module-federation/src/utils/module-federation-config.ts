import {
  createProjectGraphAsync,
  ProjectGraph,
  readCachedProjectGraph,
} from '@nx/devkit';
import {
  applyAdditionalShared,
  applySharedFunction,
  getDependentPackagesForProject,
  mapRemotes,
  mapRemotesForSSR,
  ModuleFederationConfig,
  SharedLibraryConfig,
  sharePackages,
  shareWorkspaceLibraries,
} from './index';

/**
 * Configuration options for module federation config generation.
 */
export interface ModuleFederationConfigOptions {
  /** Whether this is for server-side rendering */
  isServer?: boolean;
  /** Custom function to determine remote URLs */
  determineRemoteUrl?: (remote: string) => string;
}

/**
 * Framework-specific configuration for module federation.
 */
export interface FrameworkConfig {
  /** Bundler type affects shared library config */
  bundler: 'webpack' | 'rspack';
  /** Remote entry file extension */
  remoteEntryExt: 'js' | 'mjs';
  /** Whether to pass true as 4th param to mapRemotes */
  mapRemotesExpose?: boolean;
  /** Function to apply eager packages for this framework */
  applyEagerPackages?: (
    sharedConfig: Record<string, SharedLibraryConfig>,
    projectGraph: ProjectGraph,
    projectName: string
  ) => void;
  /** Default npm packages to always share */
  defaultPackagesToShare?: string[];
  /** npm packages to exclude from sharing */
  packagesToAvoid?: string[];
}

/**
 * Result of getModuleFederationConfig
 */
export interface ModuleFederationConfigResult {
  sharedLibraries: ReturnType<typeof shareWorkspaceLibraries>;
  sharedDependencies: Record<string, SharedLibraryConfig>;
  mappedRemotes: Record<string, string>;
}

/**
 * Core implementation for generating module federation configuration.
 * This is used by webpack, rspack, and angular utils.
 *
 * @param mfConfig - Module federation configuration
 * @param options - Configuration options
 * @param frameworkConfig - Framework-specific configuration
 * @param projectGraph - The Nx project graph
 */
function buildModuleFederationConfig(
  mfConfig: ModuleFederationConfig,
  options: ModuleFederationConfigOptions,
  frameworkConfig: FrameworkConfig,
  projectGraph: ProjectGraph
): ModuleFederationConfigResult {
  const {
    bundler,
    remoteEntryExt,
    mapRemotesExpose,
    applyEagerPackages,
    defaultPackagesToShare = [],
    packagesToAvoid = [],
  } = frameworkConfig;

  const project = projectGraph.nodes[mfConfig.name]?.data;

  if (!project) {
    throw Error(
      `Cannot find project "${mfConfig.name}". Check that the name is correct in module-federation.config.js`
    );
  }

  const dependencies = getDependentPackagesForProject(
    projectGraph,
    mfConfig.name
  );

  // Filter dependencies if shared function provided
  if (mfConfig.shared) {
    dependencies.workspaceLibraries = dependencies.workspaceLibraries.filter(
      (lib) => mfConfig.shared(lib.importKey, {}) !== false
    );
    dependencies.npmPackages = dependencies.npmPackages.filter(
      (pkg) => mfConfig.shared(pkg, {}) !== false
    );
  }

  const sharedLibraries = shareWorkspaceLibraries(
    dependencies.workspaceLibraries,
    undefined,
    bundler
  );

  // Build npm packages list with framework-specific defaults
  let npmPackagesList = dependencies.npmPackages;
  if (defaultPackagesToShare.length > 0 || packagesToAvoid.length > 0) {
    npmPackagesList = Array.from(
      new Set([
        ...defaultPackagesToShare,
        ...dependencies.npmPackages.filter(
          (pkg) => !packagesToAvoid.includes(pkg)
        ),
      ])
    );
  }

  const npmPackages = sharePackages(npmPackagesList);

  // Remove packages to avoid from final config
  for (const pkgName of packagesToAvoid) {
    if (pkgName in npmPackages) {
      delete npmPackages[pkgName];
    }
  }

  const sharedDependencies: Record<string, SharedLibraryConfig> = {
    ...sharedLibraries.getLibraries(project.root),
    ...npmPackages,
  };

  // Apply framework-specific eager packages
  if (applyEagerPackages) {
    applyEagerPackages(sharedDependencies, projectGraph, mfConfig.name);
  }

  applySharedFunction(sharedDependencies, mfConfig.shared);
  applyAdditionalShared(
    sharedDependencies,
    mfConfig.additionalShared,
    projectGraph
  );

  // Map remotes
  const mapRemotesFunction = options.isServer ? mapRemotesForSSR : mapRemotes;
  let mappedRemotes: Record<string, string> = {};

  if (mfConfig.remotes && mfConfig.remotes.length > 0) {
    const determineRemoteUrlFn =
      options.determineRemoteUrl ||
      createDefaultRemoteUrlResolver(options.isServer, remoteEntryExt);

    mappedRemotes = mapRemotesFunction(
      mfConfig.remotes,
      remoteEntryExt,
      determineRemoteUrlFn,
      mapRemotesExpose
    );
  }

  return { sharedLibraries, sharedDependencies, mappedRemotes };
}

// Cache for parsed static remotes env variable
let cachedStaticRemotesEnv: string | undefined = undefined;
let cachedStaticRemotesMap: Record<string, string> | undefined = undefined;

/**
 * Gets static remotes from env with caching.
 * Invalidates cache if env variable changes.
 */
function getStaticRemotesFromEnv(): Record<string, string> | undefined {
  const currentEnv = process.env.NX_MF_DEV_SERVER_STATIC_REMOTES;
  if (currentEnv !== cachedStaticRemotesEnv) {
    cachedStaticRemotesEnv = currentEnv;
    cachedStaticRemotesMap = currentEnv ? JSON.parse(currentEnv) : undefined;
  }
  return cachedStaticRemotesMap;
}

/**
 * Creates a default remote URL resolver function.
 * This is extracted to avoid code duplication across bundler utils.
 */
function createDefaultRemoteUrlResolver(
  isServer: boolean = false,
  remoteEntryExt: 'js' | 'mjs' = 'js'
): (remote: string) => string {
  const {
    readCachedProjectConfiguration,
  } = require('nx/src/project-graph/project-graph');
  const target = 'serve';
  const remoteEntry = isServer
    ? 'server/remoteEntry.js'
    : `remoteEntry.${remoteEntryExt}`;

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

/**
 * Async version - tries cached graph first, falls back to creating new one.
 * Used by webpack and angular async configs.
 */
export async function getModuleFederationConfigAsync(
  mfConfig: ModuleFederationConfig,
  options: ModuleFederationConfigOptions = {},
  frameworkConfig: FrameworkConfig
): Promise<ModuleFederationConfigResult> {
  let projectGraph: ProjectGraph;
  try {
    projectGraph = readCachedProjectGraph();
  } catch (e) {
    projectGraph = await createProjectGraphAsync();
  }

  return buildModuleFederationConfig(
    mfConfig,
    options,
    frameworkConfig,
    projectGraph
  );
}

/**
 * Sync version - only uses cached graph.
 * Used by rspack and angular sync configs.
 */
export function getModuleFederationConfigSync(
  mfConfig: ModuleFederationConfig,
  options: ModuleFederationConfigOptions = {},
  frameworkConfig: FrameworkConfig
): ModuleFederationConfigResult {
  const projectGraph = readCachedProjectGraph();
  return buildModuleFederationConfig(
    mfConfig,
    options,
    frameworkConfig,
    projectGraph
  );
}

/**
 * Clears the static remotes env cache.
 * Useful for testing or when the env variable changes.
 */
export function clearStaticRemotesEnvCache(): void {
  cachedStaticRemotesEnv = undefined;
  cachedStaticRemotesMap = undefined;
}

// Re-export for convenience
export { createDefaultRemoteUrlResolver };
