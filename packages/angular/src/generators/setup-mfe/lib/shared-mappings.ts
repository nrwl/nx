import {
  share,
  SharedMappings,
} from '@angular-architects/module-federation/webpack';
import {
  ProjectGraph,
  readCachedProjectGraph,
} from '@nrwl/workspace/src/core/project-graph';
import {
  findAllProjectNodeDependencies,
  findAllProjectNpmDependencies,
} from '@nrwl/workspace/src/utilities/project-graph-utils';
import { NxJsonConfiguration } from '@nrwl/tao/src/shared/nx';
import * as path from 'path';
import { readNxJson } from '@nrwl/workspace';

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
 * TODO: Functions for configuring the remote side of things
 */

function setIntersection<T>(s1: Set<T>, s2: Set<T>): Set<T> {
  return new Set([...s1].filter((x) => s2.has(x)));
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
  const nxJson = readNxJson();

  const projectGraph = readCachedProjectGraph();

  const shellRoot = projectGraph.nodes[shellName].data.root;

  const tsConfigPath = path.join(
    __dirname,
    shellRoot
      .split('/')
      .map(() => '../')
      .join('')
  );

  const sharedMappings = new SharedMappings();

  sharedMappings.register(
    tsConfigPath,
    getSharedNxDeps(nxJson, projectGraph, shellName, remotes)
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

export function getSharedNpmDepsShell(
  shellName: string,
  remotes: string[],
  defaultConfig: Partial<NpmDepShareConfig> = {}
): Record<string, NpmDepShareConfig> {
  const nxJson = readNxJson();

  const projectGraph = readCachedProjectGraph();

  const npmDeps = getSharedNpmDeps(nxJson, projectGraph, shellName, remotes);

  return npmDeps.reduce(
    (prev, depName) => ({
      ...prev,
      [depName]: {
        singleton: true,
        strictVersion: true,
        requiredVersion: true,
        includeSecondaries: false,
        ...defaultConfig,
      },
    }),
    {}
  );
}
