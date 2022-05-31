import type { Schema } from './schema';
import {
  ProjectConfiguration,
  readAllWorkspaceConfiguration,
} from '@nrwl/devkit';
import { scheduleTarget } from 'nx/src/adapter/ngcli-adapter';
import { BuilderContext, createBuilder } from '@angular-devkit/architect';
import { JsonObject } from '@angular-devkit/core';
import { join } from 'path';
import { executeWebpackServerBuilder } from '../webpack-server/webpack-server.impl';
import { existsSync, readFileSync } from 'fs';

function getDynamicRemotesIfExists(
  context: BuilderContext,
  p: ProjectConfiguration
) {
  // check for dynamic remotes
  // we should only check for dynamic based on what we generate
  // and fallback to empty array

  const standardPathToGeneratedMFManifestJson = join(
    context.workspaceRoot,
    p.sourceRoot,
    'assets/module-federation.manifest.json'
  );
  if (!existsSync(standardPathToGeneratedMFManifestJson)) {
    return [];
  }

  const moduleFederationManifestJson = readFileSync(
    standardPathToGeneratedMFManifestJson,
    'utf-8'
  );

  if (moduleFederationManifestJson) {
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

    return Object.entries(parsedManifest).reduce(
      (remotesArray, [remoteName, remoteLocation]) => [
        ...remotesArray,
        [remoteName, remoteLocation],
      ],
      []
    );
  }
  return [];
}

export function executeModuleFederationDevServerBuilder(
  schema: Schema,
  context: BuilderContext
) {
  const workspaceConfig = readAllWorkspaceConfiguration();
  const p = workspaceConfig.projects[context.target.project];

  const mfConfigPath = join(
    context.workspaceRoot,
    p.root,
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

  const { ...options } = schema;

  let unparsedRemotes = mfeConfig.remotes.length > 0 ? mfeConfig.remotes : [];
  const dynamicRemotes = getDynamicRemotesIfExists(context, p);
  unparsedRemotes = [...unparsedRemotes, ...dynamicRemotes];

  const remotes = unparsedRemotes.map((a) => (Array.isArray(a) ? a[0] : a));

  const devServeRemotes = !options.devRemotes
    ? []
    : Array.isArray(options.devRemotes)
    ? options.devRemotes
    : [options.devRemotes];

  for (const remote of remotes) {
    const isDev = devServeRemotes.includes(remote);
    const target = isDev ? 'serve' : 'serve-static';

    scheduleTarget(
      context.workspaceRoot,
      {
        project: remote,
        target,
        configuration: context.target.configuration,
        runOptions: {},
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
