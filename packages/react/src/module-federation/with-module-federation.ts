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

interface DependencySets {
  workspaceLibraries: Set<string>;
  npmPackages: Set<string>;
}

function recursivelyResolveWorkspaceDependents(
  projectGraph: ProjectGraph<any>,
  target: string,
  dependencySets: DependencySets,
  seenTargets: Set<string> = new Set()
) {
  if (seenTargets.has(target)) {
    return [];
  }
  let dependencies = [target];
  seenTargets.add(target);

  const workspaceDependencies = (
    projectGraph.dependencies[target] ?? []
  ).filter((dep) => {
    const isNpm = dep.target.startsWith('npm:');

    // If this is a npm dep ensure it is going to be added as a dep of this MFE so it can be shared if needed
    if (isNpm) {
      dependencySets.npmPackages.add(dep.target);
    } else {
      dependencySets.workspaceLibraries.add(dep.target);
    }

    return !isNpm;
  });

  if (workspaceDependencies.length > 0) {
    for (const dep of workspaceDependencies) {
      dependencies = [
        ...dependencies,
        ...recursivelyResolveWorkspaceDependents(
          projectGraph,
          dep.target,
          dependencySets,
          seenTargets
        ),
      ];
    }
  }

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

  // Build Sets for the direct deps (internal and external) for this MFE app
  const dependencySets = projectGraph.dependencies[name].reduce(
    (dependencies, dependency) => {
      const workspaceLibraries = new Set(dependencies.workspaceLibraries);
      const npmPackages = new Set(dependencies.npmPackages);

      if (dependency.target.startsWith('npm:')) {
        npmPackages.add(dependency.target.replace('npm:', ''));
      } else {
        workspaceLibraries.add(dependency.target);
      }

      return {
        workspaceLibraries,
        npmPackages,
      };
    },
    { workspaceLibraries: new Set<string>(), npmPackages: new Set<string>() }
  );

  const seenWorkspaceLibraries = new Set<string>();
  dependencySets.workspaceLibraries.forEach((workspaceLibrary) => {
    recursivelyResolveWorkspaceDependents(
      projectGraph,
      workspaceLibrary,
      dependencySets,
      seenWorkspaceLibraries
    );
  });

  const deps = {
    workspaceLibraries: [...dependencySets.workspaceLibraries],
    npmPackages: [...dependencySets.npmPackages],
  };

  deps.workspaceLibraries = mapWorkspaceLibrariesToTsConfigImport(
    deps.workspaceLibraries
  );
  return deps;
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
