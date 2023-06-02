import type { Schema } from './schema';
import { readCachedProjectGraph, workspaceRoot, Workspaces } from '@nx/devkit';
import { scheduleTarget } from 'nx/src/adapter/ngcli-adapter';
import { executeWebpackDevServerBuilder } from '../webpack-dev-server/webpack-dev-server.impl';
import { readProjectsConfigurationFromProjectGraph } from 'nx/src/project-graph/project-graph';
import {
  getDynamicRemotes,
  getStaticRemotes,
  validateDevRemotes,
} from '../utilities/module-federation';
import { existsSync } from 'fs';
import { extname, join } from 'path';
import { findMatchingProjects } from 'nx/src/utils/find-matching-projects';

export function executeModuleFederationDevServerBuilder(
  schema: Schema,
  context: import('@angular-devkit/architect').BuilderContext
) {
  const { ...options } = schema;
  const projectGraph = readCachedProjectGraph();
  const { projects: workspaceProjects } =
    readProjectsConfigurationFromProjectGraph(projectGraph);
  const ws = new Workspaces(workspaceRoot);
  const project = workspaceProjects[context.target.project];

  let pathToManifestFile = join(
    context.workspaceRoot,
    project.sourceRoot,
    'assets/module-federation.manifest.json'
  );
  if (options.pathToManifestFile) {
    const userPathToManifestFile = join(
      context.workspaceRoot,
      options.pathToManifestFile
    );
    if (!existsSync(userPathToManifestFile)) {
      throw new Error(
        `The provided Module Federation manifest file path does not exist. Please check the file exists at "${userPathToManifestFile}".`
      );
    } else if (extname(options.pathToManifestFile) !== '.json') {
      throw new Error(
        `The Module Federation manifest file must be a JSON. Please ensure the file at ${userPathToManifestFile} is a JSON.`
      );
    }

    pathToManifestFile = userPathToManifestFile;
  }

  validateDevRemotes(options, workspaceProjects);

  const remotesToSkip = new Set(
    findMatchingProjects(options.skipRemotes, projectGraph.nodes) ?? []
  );
  const staticRemotes = getStaticRemotes(
    project,
    context,
    workspaceProjects,
    remotesToSkip
  );
  const dynamicRemotes = getDynamicRemotes(
    project,
    context,
    workspaceProjects,
    remotesToSkip,
    pathToManifestFile
  );
  const remotes = [...staticRemotes, ...dynamicRemotes];

  const devServeRemotes = !options.devRemotes
    ? []
    : Array.isArray(options.devRemotes)
    ? findMatchingProjects(options.devRemotes, projectGraph.nodes)
    : findMatchingProjects([options.devRemotes], projectGraph.nodes);

  for (const remote of remotes) {
    const isDev = devServeRemotes.includes(remote);
    const target = isDev ? 'serve' : 'serve-static';

    if (!workspaceProjects[remote].targets?.[target]) {
      throw new Error(
        `Could not find "${target}" target in "${remote}" project.`
      );
    } else if (!workspaceProjects[remote].targets?.[target].executor) {
      throw new Error(
        `Could not find executor for "${target}" target in "${remote}" project.`
      );
    }

    const runOptions: { verbose?: boolean } = {};
    if (options.verbose) {
      const [collection, executor] =
        workspaceProjects[remote].targets[target].executor.split(':');
      const { schema } = ws.readExecutor(collection, executor);

      if (schema.additionalProperties || 'verbose' in schema.properties) {
        runOptions.verbose = options.verbose;
      }
    }

    scheduleTarget(
      context.workspaceRoot,
      {
        project: remote,
        target,
        configuration: context.target.configuration,
        runOptions,
      },
      options.verbose
    ).then((obs) => {
      obs.toPromise().catch((err) => {
        throw new Error(
          `Remote '${remote}' failed to serve correctly due to the following: \r\n${err.toString()}`
        );
      });
    });
  }

  return executeWebpackDevServerBuilder(options, context);
}

export default require('@angular-devkit/architect').createBuilder(
  executeModuleFederationDevServerBuilder
);
