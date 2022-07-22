import type { Schema } from './schema';
import {
  ProjectConfiguration,
  readCachedProjectGraph,
  workspaceRoot,
  Workspaces,
} from '@nrwl/devkit';
import { scheduleTarget } from 'nx/src/adapter/ngcli-adapter';
import { BuilderContext, createBuilder } from '@angular-devkit/architect';
import { JsonObject } from '@angular-devkit/core';
import { join } from 'path';
import { executeWebpackServerBuilder } from '../webpack-server/webpack-server.impl';
import { existsSync, readFileSync } from 'fs';
import { readProjectsConfigurationFromProjectGraph } from 'nx/src/project-graph/project-graph';

function getDynamicRemotes(
  project: ProjectConfiguration,
  context: BuilderContext,
  workspaceProjects: Record<string, ProjectConfiguration>
): string[] {
  // check for dynamic remotes
  // we should only check for dynamic based on what we generate
  // and fallback to empty array

  const standardPathToGeneratedMFManifestJson = join(
    context.workspaceRoot,
    project.sourceRoot,
    'assets/module-federation.manifest.json'
  );
  if (!existsSync(standardPathToGeneratedMFManifestJson)) {
    return [];
  }

  const moduleFederationManifestJson = readFileSync(
    standardPathToGeneratedMFManifestJson,
    'utf-8'
  );

  if (!moduleFederationManifestJson) {
    return [];
  }

  // This should have shape of
  // {
  //   "remoteName": "remoteLocation",
  // }
  const parsedManifest = JSON.parse(moduleFederationManifestJson);
  if (
    !Object.keys(parsedManifest).every(
      (key) =>
        typeof key === 'string' && typeof parsedManifest[key] === 'string'
    )
  ) {
    return [];
  }

  const dynamicRemotes = Object.entries(parsedManifest).map(
    ([remoteName]) => remoteName
  );
  const invalidDynamicRemotes = dynamicRemotes.filter(
    (remote) => !workspaceProjects[remote]
  );
  if (invalidDynamicRemotes.length) {
    throw new Error(
      invalidDynamicRemotes.length === 1
        ? `Invalid dynamic remote configured in "${standardPathToGeneratedMFManifestJson}": ${invalidDynamicRemotes[0]}.`
        : `Invalid dynamic remotes configured in "${standardPathToGeneratedMFManifestJson}": ${invalidDynamicRemotes.join(
            ', '
          )}.`
    );
  }

  return dynamicRemotes;
}

function getStaticRemotes(
  project: ProjectConfiguration,
  context: BuilderContext,
  workspaceProjects: Record<string, ProjectConfiguration>
): string[] {
  const mfConfigPath = join(
    context.workspaceRoot,
    project.root,
    'module-federation.config.js'
  );

  let mfeConfig: { remotes: string[] };
  try {
    mfeConfig = require(mfConfigPath);
  } catch {
    throw new Error(
      `Could not load ${mfConfigPath}. Was this project generated with "@nrwl/angular:host"?`
    );
  }

  const staticRemotes = mfeConfig.remotes.length > 0 ? mfeConfig.remotes : [];
  const invalidStaticRemotes = staticRemotes.filter(
    (remote) => !workspaceProjects[remote]
  );
  if (invalidStaticRemotes.length) {
    throw new Error(
      invalidStaticRemotes.length === 1
        ? `Invalid static remote configured in "${mfConfigPath}": ${invalidStaticRemotes[0]}.`
        : `Invalid static remotes configured in "${mfConfigPath}": ${invalidStaticRemotes.join(
            ', '
          )}.`
    );
  }

  return staticRemotes;
}

function validateDevRemotes(
  options: Schema,
  workspaceProjects: Record<string, ProjectConfiguration>
): void {
  const invalidDevRemotes = options.devRemotes?.filter(
    (remote) => !workspaceProjects[remote]
  );

  if (invalidDevRemotes.length) {
    throw new Error(
      invalidDevRemotes.length === 1
        ? `Invalid dev remote provided: ${invalidDevRemotes[0]}.`
        : `Invalid dev remotes provided: ${invalidDevRemotes.join(', ')}.`
    );
  }
}

export function executeModuleFederationDevServerBuilder(
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

  const staticRemotes = getStaticRemotes(project, context, workspaceProjects);
  const dynamicRemotes = getDynamicRemotes(project, context, workspaceProjects);
  const remotes = [...staticRemotes, ...dynamicRemotes];

  const devServeRemotes = !options.devRemotes
    ? []
    : Array.isArray(options.devRemotes)
    ? options.devRemotes
    : [options.devRemotes];

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
        executor: context.builder.builderName,
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

  return executeWebpackServerBuilder(options, context);
}

export default createBuilder<JsonObject & Schema>(
  executeModuleFederationDevServerBuilder
);
