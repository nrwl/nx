import {
  SharedLibraryConfig,
  sharePackages,
  shareWorkspaceLibraries,
} from './mfe-webpack';
import {
  createProjectGraphAsync,
  readCachedProjectGraph,
} from '@nrwl/workspace/src/core/project-graph';
import { readWorkspaceJson } from '@nrwl/workspace';
import { joinPathFragments, ProjectGraph } from '@nrwl/devkit';
import ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');
import { Workspaces } from 'nx/src/shared/workspace';
import { appRootPath } from 'nx/src/utils/app-root';
import { getRootTsConfigPath } from '@nrwl/workspace/src/utilities/typescript';
import { readTsConfig } from '@nrwl/workspace';
import { ParsedCommandLine } from 'typescript';

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

function recursivelyResolveWorkspaceDependents(
  projectGraph: ProjectGraph<any>,
  target: string
) {
  let dependencies = [target];

  const workspaceDependencies = (
    projectGraph.dependencies[target] ?? []
  ).filter((dep) => !dep.target.startsWith('npm:'));
  if (workspaceDependencies.length > 0) {
    for (const dep of workspaceDependencies) {
      dependencies = [
        ...dependencies,
        ...recursivelyResolveWorkspaceDependents(projectGraph, dep.target),
      ];
    }
  }
  return dependencies;
}

function mapWorkspaceLibrariesToTsConfigImport(workspaceLibraries: string[]) {
  const { projects } = new Workspaces(appRootPath).readWorkspaceConfiguration();
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

  const deps = projectGraph.dependencies[name].reduce(
    (dependencies, dependency) => {
      const workspaceLibraries = dependencies.workspaceLibraries;
      const npmPackages = dependencies.npmPackages;

      if (dependency.target.startsWith('npm')) {
        npmPackages.push(dependency.target.replace('npm:', ''));
      } else {
        workspaceLibraries.push(dependency.target);
      }

      return {
        workspaceLibraries,
        npmPackages,
      };
    },
    { workspaceLibraries: [], npmPackages: [] }
  );
  deps.workspaceLibraries = deps.workspaceLibraries.reduce(
    (workspaceLibraryDeps, workspaceLibrary) => [
      ...workspaceLibraryDeps,
      ...recursivelyResolveWorkspaceDependents(projectGraph, workspaceLibrary),
    ],
    []
  );

  deps.workspaceLibraries = mapWorkspaceLibrariesToTsConfigImport(
    deps.workspaceLibraries
  );
  return deps;
}

function determineRemoteUrl(remote: string) {
  const workspace = readWorkspaceJson();
  return joinPathFragments(
    workspace.projects[remote].targets.serve.options.publicHost,
    'remoteEntry.mjs'
  );
}

function mapRemotes(remotes: MFERemotes) {
  const mappedRemotes = {};

  for (const remote of remotes) {
    if (Array.isArray(remote)) {
      mappedRemotes[remote[0]] = remote[1];
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
