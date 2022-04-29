import type { Schema } from './schema';
import { Workspaces } from '@nrwl/devkit';
import { scheduleTarget } from 'nx/src/adapter/ngcli-adapter';
import { BuilderContext, createBuilder } from '@angular-devkit/architect';
import { JsonObject } from '@angular-devkit/core';
import { join } from 'path';
import { webpackServer } from '../webpack-server/webpack-server.impl';
import { exec, execSync } from 'child_process';

/**
 * Inline kill-port to prevent adding a new dependency
 */
function killPort(port, method = 'tcp') {
  port = Number.parseInt(port);

  if (!port) {
    throw new Error('Invalid argument provided for port');
  }

  if (process.platform === 'win32') {
    return exec('netstat -nao', (error, stdout, stderr) => {
      if (!stdout) return;

      const lines = stdout.split('\n');
      // The second white-space delimited column of netstat output is the local port,
      // which is the only port we care about.
      // The regex here will match only the local port column of the output
      const lineWithLocalPortRegEx = new RegExp(
        `^ *${method.toUpperCase()} *[^ ]*:${port}`,
        'gm'
      );
      const linesWithLocalPort = lines.filter((line) =>
        line.match(lineWithLocalPortRegEx)
      );

      const pids = linesWithLocalPort.reduce((acc, line) => {
        const match = line.match(/(\d*)\w*(\n|$)/gm);
        return match && match[0] && !acc.includes(match[0])
          ? acc.concat(match[0])
          : acc;
      }, []);

      return execSync(`TaskKill /F /PID ${pids.join(' /PID ')}`);
    });
  }

  return execSync(
    `lsof -ni ${method === 'udp' ? 'udp' : 'tcp'}:${port} | grep ${
      method === 'udp' ? 'UDP' : 'LISTEN'
    } | awk '{print $2}' | xargs kill -9`
  );
}

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

  const devServeRemotes = !options.devRemotes
    ? []
    : Array.isArray(options.devRemotes)
    ? options.devRemotes
    : [options.devRemotes];

  const remotePorts: number[] = [];
  for (const remote of remotes) {
    const isDev = devServeRemotes.includes(remote);
    const target = isDev ? 'serve' : 'serve-static';

    remotePorts.push(
      workspaceConfig.projects[remote]?.targets[target]?.options.port ?? 4200
    );

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
    );
  }

  // Cleanup ports on kill
  process.on('kill', () => {
    remotePorts.forEach((port) => killPort(port));
  });

  return webpackServer(options, context);
}

export default createBuilder<JsonObject & Schema>(moduleFederationDevServer);
