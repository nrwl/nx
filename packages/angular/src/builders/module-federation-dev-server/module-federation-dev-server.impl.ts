import type { Schema } from './schema';
import { Workspaces } from '@nrwl/devkit';
import { scheduleTarget } from 'nx/src/adapter/ngcli-adapter';
import { BuilderContext, createBuilder } from '@angular-devkit/architect';
import { JsonObject } from '@angular-devkit/core';
import { join } from 'path';
import { webpackServer } from '../webpack-server/webpack-server.impl';

export function moduleFederationDevServer(
  schema: Schema,
  context: BuilderContext
) {
  const workspaces = new Workspaces(context.workspaceRoot);
  const workspaceConfig = workspaces.readWorkspaceConfiguration();

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
  const unparsedRemotes = mfeConfig.remotes.length > 0 ? mfeConfig.remotes : [];
  const remotes = unparsedRemotes.map((a) => (Array.isArray(a) ? a[0] : a));

  for (const remote of remotes) {
    scheduleTarget(
      context.workspaceRoot,
      {
        project: remote,
        target: 'serve',
        configuration: context.target.configuration,
        runOptions: {},
        executor: context.builder.builderName,
      },
      options.verbose
    );
  }

  return webpackServer(options, context);
}

export default createBuilder<JsonObject & Schema>(moduleFederationDevServer);
