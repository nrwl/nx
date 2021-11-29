import type { Tree } from '@nrwl/devkit';
import type { Schema } from '../schema';

import {
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nrwl/devkit';

export function setupServeTarget(host: Tree, options: Schema) {
  const appConfig = readProjectConfiguration(host, options.appName);

  appConfig.targets['serve'] = {
    ...appConfig.targets['serve'],
    executor: '@nrwl/angular:webpack-server',
    options: {
      ...appConfig.targets['serve'].options,
      port: options.port ?? undefined,
    },
  };

  if (options.mfeType === 'host') {
    const remoteServeCommands = options.remotes
      ? options.remotes.map((r) => `nx serve ${r}`)
      : undefined;
    const commands = remoteServeCommands
      ? [
          ...remoteServeCommands,
          `nx serve ${options.appName} --liveReload=false`,
        ]
      : [`nx serve ${options.appName} --liveReload=false`];

    appConfig.targets['serve-mfe'] = {
      executor: '@nrwl/workspace:run-commands',
      options: {
        commands,
      },
    };
  }
  updateProjectConfiguration(host, options.appName, appConfig);

  if (options.mfeType === 'remote' && options.host) {
    const hostAppConfig = readProjectConfiguration(host, options.host);

    hostAppConfig.targets['serve-mfe'] = {
      ...hostAppConfig.targets['serve-mfe'],
      options: {
        ...hostAppConfig.targets['serve-mfe'].options,
        commands: [
          `nx serve ${options.appName} --liveReload=false`,
          ...hostAppConfig.targets['serve-mfe'].options.commands,
        ],
      },
    };

    updateProjectConfiguration(host, options.host, hostAppConfig);
  }
}
