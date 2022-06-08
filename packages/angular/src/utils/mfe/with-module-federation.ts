import {
  getNpmPackageSharedConfig,
  SharedLibraryConfig,
  sharePackages,
  shareWorkspaceLibraries,
} from './mfe-webpack';
import {
  createProjectGraphAsync,
  ProjectGraph,
  readAllWorkspaceConfiguration,
  readCachedProjectGraph,
} from '@nrwl/devkit';
import {
  getRootTsConfigPath,
  readTsConfig,
} from '@nrwl/workspace/src/utilities/typescript';
import { ParsedCommandLine } from 'typescript';
import { readRootPackageJson } from './utils';
import { extname, join } from 'path';
import ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');

export type MFERemotes = string[] | [remoteName: string, remoteUrl: string][];

type SharedFunction = (
  libraryName: string,
  sharedConfig: SharedLibraryConfig
) => SharedLibraryConfig | false;
type AdditionalSharedConfig = Array<
  | string
  | [libraryName: string, sharedConfig: SharedLibraryConfig]
  | { libraryName: string; sharedConfig: SharedLibraryConfig }
>;

export interface MFEConfig {
  name: string;
  remotes?: MFERemotes;
  exposes?: Record<string, string>;
  shared?: SharedFunction;
  additionalShared?: AdditionalSharedConfig;
}

function collectDependencies(
  projectGraph: ProjectGraph,
  name: string,
  dependencies = {
    workspaceLibraries: new Set<string>(),
    npmPackages: new Set<string>(),
  },
  seen: Set<string> = new Set()
): {
  workspaceLibraries: Set<string>;
  npmPackages: Set<string>;
} {
  if (seen.has(name)) {
    return dependencies;
  }
  seen.add(name);

  (projectGraph.dependencies[name] ?? []).forEach((dependency) => {
    if (dependency.target.startsWith('npm:')) {
      dependencies.npmPackages.add(dependency.target.replace('npm:', ''));
    } else {
      dependencies.workspaceLibraries.add(dependency.target);
      collectDependencies(projectGraph, dependency.target, dependencies, seen);
    }
  });

  return dependencies;
}

function mapWorkspaceLibrariesToTsConfigImport(workspaceLibraries: string[]) {
  const { projects } = readAllWorkspaceConfiguration();

  const tsConfigPath = process.env.NX_TSCONFIG_PATH ?? getRootTsConfigPath();
  const tsConfig: ParsedCommandLine = readTsConfig(tsConfigPath);

  const tsconfigPathAliases: Record<string, string[]> = tsConfig.options?.paths;

  if (!tsconfigPathAliases) {
    return workspaceLibraries;
  }

  const mappedLibraries = [];
  for (const lib of workspaceLibraries) {
    const sourceRoot = projects[lib].sourceRoot;
    let found = false;

    for (const [key, value] of Object.entries(tsconfigPathAliases)) {
      if (value.find((p) => p.startsWith(sourceRoot))) {
        mappedLibraries.push(key);
        found = true;
        break;
      }
    }

    if (!found) {
      mappedLibraries.push(lib);
    }
  }

  return mappedLibraries;
}

async function getDependentPackagesForProject(
  projectGraph: ProjectGraph,
  name: string
) {
  const { npmPackages, workspaceLibraries } = collectDependencies(
    projectGraph,
    name
  );

  return {
    workspaceLibraries: mapWorkspaceLibrariesToTsConfigImport([
      ...workspaceLibraries,
    ]),
    npmPackages: [...npmPackages],
  };
}

function determineRemoteUrl(remote: string) {
  const workspace = readAllWorkspaceConfiguration();
  let publicHost = '';
  try {
    publicHost = workspace.projects[remote].targets.serve.options.publicHost;
  } catch (error) {
    throw new Error(
      `Cannot automatically determine URL of remote (${remote}). Looked for property "publicHost" in the project's "serve" target.\n
      You can also use the tuple syntax in your webpack config to configure your remotes. e.g. \`remotes: [['remote1', 'http://localhost:4201']]\``
    );
  }
  return `${
    publicHost.endsWith('/') ? publicHost.slice(0, -1) : publicHost
  }/remoteEntry.mjs`;
}

function mapRemotes(remotes: MFERemotes) {
  const mappedRemotes = {};

  for (const remote of remotes) {
    if (Array.isArray(remote)) {
      const [remoteName, remoteLocation] = remote;
      const remoteLocationExt = extname(remoteLocation);
      mappedRemotes[remoteName] = ['.js', '.mjs'].includes(remoteLocationExt)
        ? remoteLocation
        : join(remoteLocation, 'remoteEntry.mjs');
    } else if (typeof remote === 'string') {
      mappedRemotes[remote] = determineRemoteUrl(remote);
    }
  }

  return mappedRemotes;
}

function applySharedFunction(
  sharedConfig: Record<string, SharedLibraryConfig>,
  sharedFn: SharedFunction | undefined
): void {
  if (!sharedFn) {
    return;
  }

  for (const [libraryName, library] of Object.entries(sharedConfig)) {
    const mappedDependency = sharedFn(libraryName, library);
    if (mappedDependency === false) {
      delete sharedConfig[libraryName];
      continue;
    } else if (!mappedDependency) {
      continue;
    }

    sharedConfig[libraryName] = mappedDependency;
  }
}

function addStringDependencyToSharedConfig(
  sharedConfig: Record<string, SharedLibraryConfig>,
  dependency: string,
  projectGraph: ProjectGraph
): void {
  if (projectGraph.nodes[dependency]) {
    sharedConfig[dependency] = { requiredVersion: false };
  } else if (projectGraph.externalNodes?.[dependency]) {
    const pkgJson = readRootPackageJson();
    const config = getNpmPackageSharedConfig(
      dependency,
      pkgJson.dependencies?.[dependency] ??
        pkgJson.devDependencies?.[dependency]
    );

    if (!config) {
      return;
    }

    sharedConfig[dependency] = config;
  } else {
    throw new Error(
      `The specified dependency "${dependency}" in the additionalShared configuration does not exist in the project graph. ` +
        `Please check your additionalShared configuration and make sure you are including valid workspace projects or npm packages.`
    );
  }
}

function applyAdditionalShared(
  sharedConfig: Record<string, SharedLibraryConfig>,
  additionalShared: AdditionalSharedConfig | undefined,
  projectGraph: ProjectGraph
): void {
  if (!additionalShared) {
    return;
  }

  for (const shared of additionalShared) {
    if (typeof shared === 'string') {
      addStringDependencyToSharedConfig(sharedConfig, shared, projectGraph);
    } else if (Array.isArray(shared)) {
      sharedConfig[shared[0]] = shared[1];
    } else if (typeof shared === 'object') {
      sharedConfig[shared.libraryName] = shared.sharedConfig;
    }
  }
}

function applyDefaultEagerPackages(
  sharedConfig: Record<string, SharedLibraryConfig>
) {
  const DEFAULT_PACKAGES_TO_LOAD_EAGERLY = ['@angular/localize/init'];
  for (const pkg of DEFAULT_PACKAGES_TO_LOAD_EAGERLY) {
    sharedConfig[pkg] = {
      ...(sharedConfig[pkg] ?? {}),
      eager: true,
    };
  }
}

export async function withModuleFederation(options: MFEConfig) {
  const DEFAULT_NPM_PACKAGES_TO_AVOID = ['zone.js', '@nrwl/angular/mfe'];

  let projectGraph: ProjectGraph<any>;
  try {
    projectGraph = readCachedProjectGraph();
  } catch (e) {
    projectGraph = await createProjectGraphAsync();
  }

  const dependencies = await getDependentPackagesForProject(
    projectGraph,
    options.name
  );
  const sharedLibraries = shareWorkspaceLibraries(
    dependencies.workspaceLibraries
  );

  const npmPackages = sharePackages(
    dependencies.npmPackages.filter(
      (pkg) => !DEFAULT_NPM_PACKAGES_TO_AVOID.includes(pkg)
    )
  );

  DEFAULT_NPM_PACKAGES_TO_AVOID.forEach((pkgName) => {
    if (pkgName in npmPackages) {
      delete npmPackages[pkgName];
    }
  });

  const sharedDependencies = {
    ...sharedLibraries.getLibraries(),
    ...npmPackages,
  };

  applyDefaultEagerPackages(sharedDependencies);
  applySharedFunction(sharedDependencies, options.shared);
  applyAdditionalShared(
    sharedDependencies,
    options.additionalShared,
    projectGraph
  );

  const mappedRemotes =
    !options.remotes || options.remotes.length === 0
      ? {}
      : mapRemotes(options.remotes);

  return (config) => ({
    ...(config ?? {}),
    output: {
      ...(config.output ?? {}),
      uniqueName: options.name,
      publicPath: 'auto',
    },
    optimization: {
      ...(config.optimization ?? {}),
      runtimeChunk: false,
    },
    resolve: {
      ...(config.resolve ?? {}),
      alias: {
        ...(config.resolve?.alias ?? {}),
        ...sharedLibraries.getAliases(),
      },
    },
    experiments: {
      ...(config.experiments ?? {}),
      outputModule: true,
    },
    plugins: [
      ...(config.plugins ?? []),
      new ModuleFederationPlugin({
        name: options.name,
        filename: 'remoteEntry.mjs',
        exposes: options.exposes,
        remotes: mappedRemotes,
        shared: {
          ...sharedDependencies,
        },
        library: {
          type: 'module',
        },
      }),
      sharedLibraries.getReplacementPlugin(),
    ],
  });
}
