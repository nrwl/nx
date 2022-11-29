import type { Schema } from './schema';
import type { BuilderContext } from '@angular-devkit/architect';
import { createBuilder } from '@angular-devkit/architect';
import type { JsonObject } from '@angular-devkit/core';
import { executeSSRDevServerBuilder } from '@nguniversal/builders';
import { readProjectsConfigurationFromProjectGraph } from 'nx/src/project-graph/project-graph';
import {
  logger,
  readCachedProjectGraph,
  workspaceRoot,
  Workspaces,
} from '@nrwl/devkit';
import {
  getDynamicRemotes,
  getStaticRemotes,
  validateDevRemotes,
} from '../utilities/module-federation';
import { exec } from 'child_process';
import { switchMap } from 'rxjs/operators';
import { from } from 'rxjs';

export function executeModuleFederationDevSSRBuilder(
  schema: Schema,
  context: BuilderContext
) {
  const { ...options } = schema;
  const projectGraph = readCachedProjectGraph();
  const { projects: workspaceProjects } =
    readProjectsConfigurationFromProjectGraph(projectGraph);
  const ws = new Workspaces(workspaceRoot);
  const project = workspaceProjects[context.target.project];

  validateDevRemotes(options, workspaceProjects);

  const remotesToSkip = new Set(options.skipRemotes ?? []);
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
    remotesToSkip
  );
  const remotes = [...staticRemotes, ...dynamicRemotes];

  const devServeRemotes = !options.devRemotes
    ? []
    : Array.isArray(options.devRemotes)
    ? options.devRemotes
    : [options.devRemotes];

  const remoteProcessPromises = [];
  for (const remote of remotes) {
    const isDev = devServeRemotes.includes(remote);
    const target = isDev ? 'serve-ssr' : 'static-server';

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

    const remotePromise = new Promise<void>((res, rej) => {
      const child = exec(
        `npx nx run ${remote}:${target}${
          context.target.configuration ? `:${context.target.configuration}` : ''
        }`
      );
      child.stdout.on('data', (data) => {
        logger.log(data);
        if (
          data.includes('Node Express server listening') ||
          data.includes(
            'Angular Universal Live Development Server is listening'
          )
        ) {
          res();
        }
      });
    });

    remoteProcessPromises.push(remotePromise);
  }

  return from(Promise.all(remoteProcessPromises)).pipe(
    switchMap(() => executeSSRDevServerBuilder(options, context))
  );
}

export default createBuilder<JsonObject & Schema>(
  executeModuleFederationDevSSRBuilder
);
