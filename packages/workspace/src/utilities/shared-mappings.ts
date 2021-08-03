import { NxJsonConfiguration, ProjectGraph } from '@nrwl/devkit';
import * as path from 'path';
import { readNxJson } from '../core/file-utils';
import { readCachedProjectGraph } from '../core/project-graph';
import {
  findAllProjectNodeDependencies,
  findAllProjectNpmDependencies,
} from './project-graph-utils';
import { SharedMappings } from '@angular-architects/module-federation/webpack';

interface NpmDepShareConfig {
  singleton: boolean;
  strictVersion: boolean;
  requiredVersion: boolean;
  includeSecondaries: boolean;
}

/**
 * Utilities for generating the shared dependencies (Nx + NPM) needed for
 * the module federation plugin.
 *
 * Modified example from https://github.com/manfredsteyer/module-federation-plugin-example/blob/main/projects/shell/webpack.config.js:
 * shell/host `webpack.config.js`
 * Nx Project name for shell is: `app1`
 * Has two remotes: `remote1` and `remote2`
 *
 const sharedMappings = getSharedMappingsShell('app1', ['remote1', 'remote2']);

 module.exports = {
  // nothing different with other keys not listed
  resolve: {
    alias: {
      ...sharedMappings.getAliases(),
    }
  },
  plugins: [
    new ModuleFederationPlugin({
      // nothing different with other keys not listed
      shared: {
        ...getSharedNpmDepsShell('app1', ['remote1', 'remote2']),
        ...sharedMappings.getDescriptors()
      }

    }),
    sharedMappings.getPlugin(),
  ],
};
 *
 * remote1 `webpack.config.js`
  const sharedMappings = getSharedMappingsRemote('remote1', 'shell');

  module.exports = {
    output: {
      uniqueName: 'remote1',
      publicPath: 'auto',
    },
    optimization: {
      runtimeChunk: false,
      minimize: false,
    },
    resolve: {
      alias: {
        ...sharedMappings.getAliases(),
      },
    },
    plugins: [
      new ModuleFederationPlugin({
        name: 'remote1',
        filename: 'remoteEntry.js',
        exposes: {
          './Module': 'apps/remote1/src/app/remote-entry/entry.module.ts',
        },
        shared: {
          ...getSharedNpmDepsRemote('remote1', 'host'),
          ...sharedMappings.getDescriptors(),
        },
      }),
      sharedMappings.getPlugin(),
    ],
  };
 */

  /**
   * Find the intersection of two sets
   * @param s1
   * @param s2 
   * @returns 
   */
function setIntersection<T>(s1: Set<T>, s2: Set<T>): Set<T> {
  return new Set([...s1].filter((x) => s2.has(x)));
}

/**
 * Find the path to the root tsconfig.base.json
 * @returns path to the root tsconfig.base.json
 */
function getTsConfigPath(): string {
  return `${process.cwd()}/tsconfig.base.json`;
}

function initSharedMappings(projectName: string): {
  nxJson: NxJsonConfiguration;
  projectGraph: ProjectGraph;
  sharedMappings: SharedMappings;
  tsConfigPath: string;
} {
  const nxJson = readNxJson();

  const projectGraph = readCachedProjectGraph();

  const tsConfigPath = getTsConfigPath();

  const sharedMappings = new SharedMappings();

  return {
    nxJson,
    projectGraph,
    sharedMappings,
    tsConfigPath,
  };
}

/**
 * Will get the shared Nx dependencies between a source and a list of targets
 * @param nxJson
 * @param projectGraph
 * @param source
 * @param targets
 */
export function getSharedNxDeps(
  nxJson: NxJsonConfiguration,
  projectGraph: ProjectGraph,
  source: string,
  targets: string[]
): string[] {
  const npmScope = `@${nxJson.npmScope}`;

  const hostDeps = findAllProjectNodeDependencies(source, projectGraph);

  const remoteDeps = new Set<string>(
    targets
      .map((remote) => findAllProjectNodeDependencies(remote, projectGraph))
      .flat()
  );

  // Find the set intersection of the host and remotes deps
  const sharedDeps = setIntersection(new Set(hostDeps), remoteDeps);

  return [...sharedDeps].map((dep) => {
    const projectRoot = projectGraph.nodes[dep].data.root.split('/');
    projectRoot.shift();
    return `${npmScope}/${projectRoot.join('/')}`;
  });
}

export function getSharedMappingsShell(
  shellName: string,
  remotes: string[]
): SharedMappings {
  const { sharedMappings, nxJson, projectGraph, tsConfigPath } =
    initSharedMappings(shellName);

  sharedMappings.register(
    tsConfigPath,
    getSharedNxDeps(nxJson, projectGraph, shellName, remotes)
  );

  return sharedMappings;
}

export function getSharedMappingsRemote(
  remoteName: string,
  shellName: string
): SharedMappings {
  const { sharedMappings, nxJson, projectGraph, tsConfigPath } =
    initSharedMappings(shellName);

  // Uses the same function as when calculating shared with one shell and many remotes
  sharedMappings.register(
    tsConfigPath,
    getSharedNxDeps(nxJson, projectGraph, shellName, [remoteName])
  );

  return sharedMappings;
}

/**
 * Will calculate and return an array of npm dependencies (target: npm:<dep>)
 * that source shares with all of the targets
 * @param nxJson
 * @param projectGraph
 * @param source
 * @param targets
 */
export function getSharedNpmDeps(
  nxJson: NxJsonConfiguration,
  projectGraph: ProjectGraph,
  source: string,
  targets: string[]
): string[] {
  const hostDeps = new Set<string>(
    findAllProjectNpmDependencies(source, projectGraph)
  );

  const remoteDeps = new Set<string>(
    targets
      .map((remote) => findAllProjectNpmDependencies(remote, projectGraph))
      .flat()
  );

  const sharedNpmDeps = setIntersection(hostDeps, remoteDeps);

  return [...sharedNpmDeps].map((dep) => dep.replace('npm:', ''));
}

export function getSharedNpmDepConfigs(
  source: string,
  targets: string[],
  defaultConfig: Partial<NpmDepShareConfig>
): Record<string, NpmDepShareConfig> {
  const nxJson = readNxJson();

  const projectGraph = readCachedProjectGraph();

  const npmDeps = getSharedNpmDeps(nxJson, projectGraph, source, targets);

  return npmDeps.reduce(
    (prev, depName) => ({
      ...prev,
      [depName]: {
        singleton: true,
        strictVersion: true,
        requiredVersion: 'auto',
        ...defaultConfig,
      },
    }),
    {}
  );
}

// Currently getSharedNpmDepsRemote and getSharedNpmDepsShell do essentially the same thing but are different functions in expectation they might need to be configured separately in the future.

export function getSharedNpmDepsRemote(
  remoteName: string,
  shellName: string,
  defaultConfig: Partial<NpmDepShareConfig> = {}
): Record<string, NpmDepShareConfig> {
  return getSharedNpmDepConfigs(shellName, [remoteName], defaultConfig);
}

export function getSharedNpmDepsShell(
  shellName: string,
  remotes: string[],
  defaultConfig: Partial<NpmDepShareConfig> = {}
): Record<string, NpmDepShareConfig> {
  return getSharedNpmDepConfigs(shellName, remotes, defaultConfig);
}
