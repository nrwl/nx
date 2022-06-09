#!/usr/bin/env node
import {
  findWorkspaceRoot,
  WorkspaceTypeAndRoot,
} from '../src/utils/find-workspace-root';
import * as chalk from 'chalk';
import { initLocal } from './init-local';
import { detectPackageManager } from '../src/utils/package-manager';
import { output } from '../src/utils/output';

const workspace = findWorkspaceRoot(process.cwd());
// new is a special case because there is no local workspace to load
if (
  process.argv[2] === 'new' ||
  process.argv[2] === '_migrate' ||
  process.argv[2] === 'init' ||
  (process.argv[2] === 'graph' && !workspace)
) {
  process.env.NX_DAEMON = 'false';
  require('nx/src/command-line/nx-commands').commandsObject.argv;
} else {
  if (workspace && workspace.type === 'nx') {
    require('v8-compile-cache');
  }
  // polyfill rxjs observable to avoid issues with multiple version fo Observable installed in node_modules
  // https://twitter.com/BenLesh/status/1192478226385428483?s=20
  if (!(Symbol as any).observable)
    (Symbol as any).observable = Symbol('observable polyfill');

  if (!workspace) {
    output.log({
      title: `The current directory isn't part of an Nx workspace.`,
      bodyLines: [
        `To create a workspace run:`,
        chalk.bold.white(`npx create-nx-workspace@latest <workspace name>`),
        '',
        `To add Nx to existing workspace run with a workspace-specific nx.json:`,
        chalk.bold.white(`npx add-nx-to-monorepo@latest`),
        '',
        `To add the default nx.json file run:`,
        chalk.bold.white(`nx init`),
      ],
    });

    output.note({
      title: `For more information please visit https://nx.dev/`,
    });
    process.exit(1);
  }

  // Make sure that a local copy of Nx exists in workspace
  let localNx: string;
  try {
    localNx = resolveNx(workspace);
  } catch {
    output.error({
      title: `Could not find Nx modules in this workspace.`,
      bodyLines: [`Have you run ${chalk.bold.white(`npm/yarn install`)}?`],
    });
    process.exit(1);
  }

  // this file is already in the local workspace
  if (localNx === resolveNx(null)) {
    initLocal(workspace);
  } else {
    const packageManager = detectPackageManager();
    if (packageManager === 'pnpm') {
      const tip =
        process.platform === 'win32'
          ? 'doskey pnx=pnpm nx -- $*'
          : `alias pnx="pnpm nx --"`;
      output.warn({
        title: `Running global Nx CLI with PNPM may have issues.`,
        bodyLines: [
          `Prefer to use "pnpm" (https://pnpm.io/cli/exec) to execute commands in this workspace.`,
          `${chalk.reset.inverse.bold.cyan(
            ' TIP '
          )} create a shortcut such as: ${chalk.bold.white(tip)}`,
          ``,
        ],
      });
    }

    // Nx is being run from globally installed CLI - hand off to the local
    require(localNx);
  }
}

function resolveNx(workspace: WorkspaceTypeAndRoot | null) {
  try {
    return require.resolve('nx/bin/nx.js', {
      paths: workspace ? [workspace.dir] : undefined,
    });
  } catch {
    return require.resolve('@nrwl/cli/bin/nx.js', {
      paths: workspace ? [workspace.dir] : undefined,
    });
  }
}
