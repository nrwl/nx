import {
  getNpmPackageSharedConfig,
  sharePackages,
  shareWorkspaceLibraries,
} from './webpack-utils';
import {
  createProjectGraphAsync,
  ProjectConfiguration,
  ProjectGraph,
  readCachedProjectGraph,
} from '@nrwl/devkit';
import {
  getRootTsConfigPath,
  readTsConfig,
} from '@nrwl/workspace/src/utilities/typescript';
import { ParsedCommandLine } from 'typescript';
import {
  AdditionalSharedConfig,
  ModuleFederationConfig,
  Remotes,
  SharedFunction,
  SharedLibraryConfig,
} from './models';
import { readRootPackageJson } from './package-json';
import { extname, join } from 'path';
import ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');

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

function mapWorkspaceLibrariesToTsConfigImport(
  workspaceLibraries: string[],
  { nodes }: ProjectGraph
) {
  const tsConfigPath = process.env.NX_TSCONFIG_PATH ?? getRootTsConfigPath();
  const tsConfig: ParsedCommandLine = readTsConfig(tsConfigPath);

  const tsconfigPathAliases: Record<string, string[]> = tsConfig.options?.paths;

  if (!tsconfigPathAliases) {
    return workspaceLibraries;
  }

  const mappedLibraries = [];
  for (const lib of workspaceLibraries) {
    const sourceRoot = nodes[lib].data.sourceRoot;
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
    workspaceLibraries: mapWorkspaceLibrariesToTsConfigImport(
      [...workspaceLibraries],
      projectGraph
    ),
    npmPackages: [...npmPackages],
  };
}

function determineRemoteUrl(remote: string, projectGraph: ProjectGraph) {
  const remoteConfiguration = projectGraph.nodes[remote].data;
  const serveTarget = remoteConfiguration?.targets?.serve;

  if (!serveTarget) {
    throw new Error(
      `Cannot automatically determine URL of remote (${remote}). Looked for property "host" in the project's "serve" target.\n
      You can also use the tuple syntax in your webpack config to configure your remotes. e.g. \`remotes: [['remote1', '//localhost:4201']]\``
    );
  }

  const host = serveTarget.options?.host ?? '//localhost';
  const port = serveTarget.options?.port ?? 4201;
  return `${
    host.endsWith('/') ? host.slice(0, -1) : host
  }:${port}/remoteEntry.js`;
}

function mapRemotes(remotes: Remotes, projectGraph: ProjectGraph) {
  const mappedRemotes = {};

  for (const remote of remotes) {
    if (Array.isArray(remote)) {
      let [remoteName, remoteLocation] = remote;
      const remoteLocationExt = extname(remoteLocation);
      mappedRemotes[remoteName] = ['.js', '.mjs'].includes(remoteLocationExt)
        ? remoteLocation
        : join(remoteLocation, 'remoteEntry.js');
    } else if (typeof remote === 'string') {
      mappedRemotes[remote] = determineRemoteUrl(remote, projectGraph);
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

export async function withModuleFederation(options: ModuleFederationConfig) {
  const reactWebpackConfig = require('../../plugins/webpack');
  let projectGraph: ProjectGraph<ProjectConfiguration>;
  try {
    projectGraph = readCachedProjectGraph();
  } catch (e) {
    projectGraph = await createProjectGraphAsync();
  }

  const project = projectGraph.nodes[options.name].data;

  if (!project) {
    throw Error(
      `Cannot find project "${options.name}". Check that the name is correct in module-federation.config.js`
    );
  }

  const dependencies = await getDependentPackagesForProject(
    projectGraph,
    options.name
  );
  const sharedLibraries = shareWorkspaceLibraries(
    dependencies.workspaceLibraries
  );

  const npmPackages = sharePackages(dependencies.npmPackages);

  const sharedDependencies = {
    ...sharedLibraries.getLibraries(),
    ...npmPackages,
  };

  applySharedFunction(sharedDependencies, options.shared);
  applyAdditionalShared(
    sharedDependencies,
    options.additionalShared,
    projectGraph
  );

  return (config) => {
    config = reactWebpackConfig(config);
    config.output.uniqueName = options.name;
    config.output.publicPath = 'auto';

    config.optimization = {
      runtimeChunk: false,
      minimize: false,
    };

    config.experiments = {
      ...config.experiments,
      outputModule: true,
    };

    const mappedRemotes =
      !options.remotes || options.remotes.length === 0
        ? {}
        : mapRemotes(options.remotes, projectGraph);

    config.plugins.push(
      new ModuleFederationPlugin({
        name: options.name,
        library: {
          type: 'module',
        },
        filename: 'remoteEntry.js',
        exposes: options.exposes,
        remotes: mappedRemotes,
        shared: {
          ...sharedDependencies,
        },
      }),
      sharedLibraries.getReplacementPlugin()
    );

    return config;
  };
}
