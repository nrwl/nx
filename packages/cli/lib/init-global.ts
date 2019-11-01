import chalk from 'chalk';
import * as path from 'path';
import { findWorkspaceRoot } from './find-workspace-root';
import { output } from './output';

/**
 * Nx is being run from outside a workspace
 */
export function initGlobal() {
  const workspace = findWorkspaceRoot(process.cwd());

  if (workspace) {
    // Found a workspace root - hand off to the local copy of Nx
    require(path.join(
      workspace.dir,
      'node_modules',
      '@nrwl',
      'cli',
      'bin',
      'nx.js'
    ));
  } else {
    output.log({
      title: `The current directory isn't part of an Nx workspace.`,
      bodyLines: [
        `To create a workspace run:`,
        chalk.bold.white(`npx create-nx-workspace@latest <workspace name>`)
      ]
    });

    output.note({
      title: `For more information please visit https://nx.dev/`
    });
    process.exit(0);
  }
}
