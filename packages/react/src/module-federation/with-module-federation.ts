import { sharePackages, shareWorkspaceLibraries } from './webpack-utils';
import {
  createProjectGraphAsync,
  ProjectGraph,
  readCachedProjectGraph,
  workspaceRoot,
  Workspaces,
} from '@nrwl/devkit';
import {
  getRootTsConfigPath,
  readTsConfig,
} from '@nrwl/workspace/src/utilities/typescript';
import { ParsedCommandLine } from 'typescript';
import { readWorkspaceJson } from 'nx/src/project-graph/file-utils';
import { ModuleFederationConfig, Remotes } from './models';
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

function mapWorkspaceLibrariesToTsConfigImport(workspaceLibraries: string[]) {
  const { projects } = new Workspaces(
    workspaceRoot
  ).readWorkspaceConfiguration();

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

async function getDependentPackagesForProject(name: string) {
  let projectGraph: ProjectGraph<any>;
  try {
    projectGraph = readCachedProjectGraph();
  } catch (e) {
    projectGraph = await createProjectGraphAsync();
  }

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
  const workspace = readWorkspaceJson();
  const serveTarget = workspace.projects[remote]?.targets?.serve;

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

function mapRemotes(remotes: Remotes) {
  const mappedRemotes = {};

  for (const remote of remotes) {
    if (Array.isArray(remote)) {
      let [remoteName, remoteLocation] = remote;
      if (!remoteLocation.match(/remoteEntry\.(js|mjs)$/)) {
        remoteLocation = `${
          remoteLocation.endsWith('/')
            ? remoteLocation.slice(0, -1)
            : remoteLocation
        }/remoteEntry.js`;
      }
      mappedRemotes[remoteName] = remoteLocation;
    } else if (typeof remote === 'string') {
      mappedRemotes[remote] = determineRemoteUrl(remote);
    }
  }

  return mappedRemotes;
}

export async function withModuleFederation(options: ModuleFederationConfig) {
  const reactWebpackConfig = require('../../plugins/webpack');
  const ws = readWorkspaceJson();
  const project = ws.projects[options.name];

  if (!project) {
    throw Error(
      `Cannot find project "${options.name}". Check that the name is correct in module-federation.config.js`
    );
  }

  const dependencies = await getDependentPackagesForProject(options.name);
  const sharedLibraries = shareWorkspaceLibraries(
    dependencies.workspaceLibraries
  );

  const npmPackages = sharePackages(dependencies.npmPackages);

  const sharedDependencies = {
    ...sharedLibraries.getLibraries(),
    ...npmPackages,
  };

  if (options.shared) {
    for (const [libraryName, library] of Object.entries(sharedDependencies)) {
      const mappedDependency = options.shared(libraryName, library);
      if (mappedDependency === false) {
        delete sharedDependencies[libraryName];
        continue;
      } else if (!mappedDependency) {
        continue;
      }

      sharedDependencies[libraryName] = mappedDependency;
    }
  }

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
        : mapRemotes(options.remotes);

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
