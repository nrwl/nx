import {
  SharedLibraryConfig,
  sharePackages,
  shareWorkspaceLibraries,
} from './mfe-webpack';
import {
  workspaceRoot,
  createProjectGraphAsync,
  ProjectGraph,
  readCachedProjectGraph,
  Workspaces,
} from '@nrwl/devkit';
import {
  getRootTsConfigPath,
  readTsConfig,
} from '@nrwl/workspace/src/utilities/typescript';
import { ParsedCommandLine } from 'typescript';
import { readWorkspaceJson } from 'nx/src/project-graph/file-utils';
import ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');

export type MFERemotes = string[] | [remoteName: string, remoteUrl: string][];

export interface MFEConfig {
  name: string;
  remotes?: MFERemotes;
  exposes?: Record<string, string>;
  shared?: (
    libraryName: string,
    library: SharedLibraryConfig
  ) => SharedLibraryConfig | false;
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
      const remoteLocation = remote[1].match(/remoteEntry\.(js|mjs)/)
        ? remote[1]
        : `${
            remote[1].endsWith('/') ? remote[1].slice(0, -1) : remote[1]
          }/remoteEntry.mjs`;
      mappedRemotes[remote[0]] = remoteLocation;
    } else if (typeof remote === 'string') {
      mappedRemotes[remote] = determineRemoteUrl(remote);
    }
  }

  return mappedRemotes;
}

export async function withModuleFederation(options: MFEConfig) {
  const DEFAULT_NPM_PACKAGES_TO_AVOID = ['zone.js'];

  const dependencies = await getDependentPackagesForProject(options.name);
  const sharedLibraries = shareWorkspaceLibraries(
    dependencies.workspaceLibraries
  );

  const npmPackages = sharePackages(
    dependencies.npmPackages.filter(
      (pkg) => !DEFAULT_NPM_PACKAGES_TO_AVOID.includes(pkg)
    )
  );

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
