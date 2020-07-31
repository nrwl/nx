import chalk from 'chalk';
import * as fs from 'fs';
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
    const localNx = path.join(
      workspace.dir,
      'node_modules',
      '@nrwl',
      'cli',
      'bin',
      'nx.js'
    );
    if (fs.existsSync(localNx)) {
      require(localNx);
    } else {
      if (fs.existsSync(path.join(workspace.dir, 'node_modules'))) {
        output.error({
          title: `Could not find Nx in this workspace.`,
          bodyLines: [
            `To convert an Angular workspace to Nx run: ${chalk.bold.white(
              `ng add @nrwl/workspace`
            )}`,
          ],
        });
      } else {
        output.error({
          title: `Could not find a node_modules folder in this workspace.`,
          bodyLines: [`Have you run ${chalk.bold.white(`npm/yarn install`)}?`],
        });
      }
      process.exit(1);
    }
  } else {
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
}
