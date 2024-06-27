import { logger, type ProjectGraph } from '@nx/devkit';
import { registerTsProject } from '@nx/js/src/internal';
import { findMatchingProjects } from 'nx/src/utils/find-matching-projects';
import * as chalk from 'chalk';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { ModuleFederationConfig } from './models/index';

interface ModuleFederationExecutorContext {
  projectName: string;
  projectGraph: ProjectGraph;
  root: string;
}

function extractRemoteProjectsFromConfig(
  config: ModuleFederationConfig,
  pathToManifestFile?: string
) {
  const remotes = [];
  const dynamicRemotes = [];
  if (pathToManifestFile && existsSync(pathToManifestFile)) {
    const moduleFederationManifestJson = readFileSync(
      pathToManifestFile,
      'utf-8'
    );

    if (moduleFederationManifestJson) {
      // This should have shape of
      // {
      //   "remoteName": "remoteLocation",
      // }
      const parsedManifest = JSON.parse(moduleFederationManifestJson);
      if (
        Object.keys(parsedManifest).every(
          (key) =>
            typeof key === 'string' && typeof parsedManifest[key] === 'string'
        )
      ) {
        dynamicRemotes.push(...Object.keys(parsedManifest));
      }
    }
  }
  const staticRemotes =
    config.remotes?.map((r) => (Array.isArray(r) ? r[0] : r)) ?? [];
  remotes.push(...staticRemotes);
  return { remotes, dynamicRemotes };
}

function collectRemoteProjects(
  remote: string,
  collected: Set<string>,
  context: ModuleFederationExecutorContext
) {
  const remoteProject = context.projectGraph.nodes[remote]?.data;
  if (!context.projectGraph.nodes[remote] || collected.has(remote)) {
    return;
  }

  collected.add(remote);

  const remoteProjectRoot = remoteProject.root;
  const remoteProjectTsConfig = remoteProject.targets['build'].options.tsConfig;
  const remoteProjectConfig = getModuleFederationConfig(
    remoteProjectTsConfig,
    context.root,
    remoteProjectRoot
  );
  const { remotes: remoteProjectRemotes } =
    extractRemoteProjectsFromConfig(remoteProjectConfig);

  remoteProjectRemotes.forEach((r) =>
    collectRemoteProjects(r, collected, context)
  );
}

export function getRemotes(
  devRemotes: string[],
  skipRemotes: string[],
  config: ModuleFederationConfig,
  context: ModuleFederationExecutorContext,
  pathToManifestFile?: string
) {
  const collectedRemotes = new Set<string>();
  const { remotes, dynamicRemotes } = extractRemoteProjectsFromConfig(
    config,
    pathToManifestFile
  );
  remotes.forEach((r) => collectRemoteProjects(r, collectedRemotes, context));
  const remotesToSkip = new Set(
    findMatchingProjects(skipRemotes, context.projectGraph.nodes) ?? []
  );

  if (remotesToSkip.size > 0) {
    logger.info(
      `Remotes not served automatically: ${[...remotesToSkip.values()].join(
        ', '
      )}`
    );
  }

  const knownRemotes = Array.from(collectedRemotes).filter(
    (r) => !remotesToSkip.has(r)
  );

  const knownDynamicRemotes = dynamicRemotes.filter(
    (r) => !remotesToSkip.has(r) && context.projectGraph.nodes[r]
  );

  logger.info(
    `NX Starting module federation dev-server for ${chalk.bold(
      context.projectName
    )} with ${[...knownRemotes, ...knownDynamicRemotes].length} remotes`
  );

  const devServeApps = new Set(
    !devRemotes
      ? []
      : Array.isArray(devRemotes)
      ? findMatchingProjects(devRemotes, context.projectGraph.nodes)
      : findMatchingProjects([devRemotes], context.projectGraph.nodes)
  );

  const staticRemotes = knownRemotes.filter((r) => !devServeApps.has(r));
  const devServeRemotes = [...knownRemotes, ...dynamicRemotes].filter((r) =>
    devServeApps.has(r)
  );
  const staticDynamicRemotes = knownDynamicRemotes.filter(
    (r) => !devServeApps.has(r)
  );
  const remotePorts = [...devServeRemotes, ...staticDynamicRemotes].map(
    (r) => context.projectGraph.nodes[r].data.targets['serve'].options.port
  );

  return {
    staticRemotes,
    devRemotes: devServeRemotes,
    dynamicRemotes: staticDynamicRemotes,
    remotePorts,
  };
}

export function getModuleFederationConfig(
  tsconfigPath: string,
  workspaceRoot: string,
  projectRoot: string,
  pluginName: 'react' | 'angular' = 'react'
) {
  const moduleFederationConfigPathJS = join(
    workspaceRoot,
    projectRoot,
    'module-federation.config.js'
  );

  const moduleFederationConfigPathTS = join(
    workspaceRoot,
    projectRoot,
    'module-federation.config.ts'
  );

  let moduleFederationConfigPath = moduleFederationConfigPathJS;

  // create a no-op so this can be called with issue
  const fullTSconfigPath = tsconfigPath.startsWith(workspaceRoot)
    ? tsconfigPath
    : join(workspaceRoot, tsconfigPath);
  let cleanupTranspiler = () => {};
  if (existsSync(moduleFederationConfigPathTS)) {
    cleanupTranspiler = registerTsProject(fullTSconfigPath);
    moduleFederationConfigPath = moduleFederationConfigPathTS;
  }

  try {
    const config = require(moduleFederationConfigPath);
    cleanupTranspiler();

    return config.default || config;
  } catch {
    throw new Error(
      `Could not load ${moduleFederationConfigPath}. Was this project generated with "@nx/${pluginName}:host"?\nSee: https://nx.dev/concepts/more-concepts/faster-builds-with-module-federation`
    );
  }
}
