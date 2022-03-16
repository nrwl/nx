import {
  SharedLibraryConfig,
  sharePackages,
  shareWorkspaceLibraries,
} from './mfe-webpack';
import {
  createProjectGraphAsync,
  readCachedProjectGraph,
} from '@nrwl/workspace/src/core/project-graph';
import { readWorkspaceJson } from '@nrwl/workspace/src/core/file-utils';
import { joinPathFragments, ProjectGraph } from '@nrwl/devkit';
import ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');
import { Workspaces } from 'nx/src/shared/workspace';
import { appRootPath } from 'nx/src/utils/app-root';
import {
  getRootTsConfigPath,
  readTsConfig,
} from '@nrwl/workspace/src/utilities/typescript';
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
  target: string,
  seenTargets: Set<string> = new Set()
) {
  if (seenTargets.has(target)) {
    return [];
  }
  let dependencies = [target];
  seenTargets.add(target);

  const workspaceDependencies = (
    projectGraph.dependencies[target] ?? []
  ).filter((dep) => !dep.target.startsWith('npm:'));
  if (workspaceDependencies.length > 0) {
    for (const dep of workspaceDependencies) {
      dependencies = [
        ...dependencies,
        ...recursivelyResolveWorkspaceDependents(
          projectGraph,
          dep.target,
          seenTargets
        ),
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
      const workspaceLibraries = new Set(dependencies.workspaceLibraries);
      const npmPackages = new Set(dependencies.npmPackages);

      if (dependency.target.startsWith('npm:')) {
        npmPackages.add(dependency.target.replace('npm:', ''));
      } else {
        workspaceLibraries.add(dependency.target);
      }

      return {
        workspaceLibraries: [...workspaceLibraries],
        npmPackages: [...npmPackages],
      };
    },
    { workspaceLibraries: [], npmPackages: [] }
  );
  const seenWorkspaceLibraries = new Set<string>();
  deps.workspaceLibraries = deps.workspaceLibraries.reduce(
    (workspaceLibraryDeps, workspaceLibrary) => [
      ...workspaceLibraryDeps,
      ...recursivelyResolveWorkspaceDependents(
        projectGraph,
        workspaceLibrary,
        seenWorkspaceLibraries
      ),
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
  let publicHost = '';
  try {
    publicHost = workspace.projects[remote].targets.serve.options.publicHost;
  } catch (error) {
    throw new Error(
      `Cannot automatically determine URL of remote (${remote}). Looked for property "publicHost" in the project's "serve" target.\n
      You can also use the tuple syntax in your webpack config to configure your remotes. e.g. \`remotes: [['remote1', 'http://localhost:4201']]\``
    );
  }
  return joinPathFragments(publicHost, 'remoteEntry.mjs');
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
