#!/usr/bin/env node
import { findWorkspaceRoot } from '../lib/find-workspace-root';
const workspace = findWorkspaceRoot(process.cwd());
if (workspace.type === 'nx') {
  require('v8-compile-cache');
}
// polyfill rxjs observable to avoid issues with multiple version fo Observable installed in node_modules
// https://twitter.com/BenLesh/status/1192478226385428483?s=20
if (!(Symbol as any).observable)
  (Symbol as any).observable = Symbol('observable polyfill');
import * as chalk from 'chalk';
import { initLocal } from '../lib/init-local';
import { output } from '../lib/output';
import { detectPackageManager } from '@nrwl/tao/src/shared/package-manager';

if (!workspace) {
  output.log({
    title: `The current directory isn't part of an Nx workspace.`,
    bodyLines: [
      `To create a workspace run:`,
      chalk.bold.white(`npx create-nx-workspace@latest <workspace name>`),
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
  localNx = require.resolve('@nrwl/cli/bin/nx.js', {
    paths: [workspace.dir],
  });
} catch {
  output.error({
    title: `Could not find Nx modules in this workspace.`,
    bodyLines: [`Have you run ${chalk.bold.white(`npm/yarn install`)}?`],
  });
  process.exit(1);
}

if (localNx === require.resolve('@nrwl/cli/bin/nx.js')) {
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
