import * as path from 'path';
import { Workspace } from './workspace';

/**
 * Nx is being run inside a workspace.
 *
 * @param workspace Relevant local workspace properties
 */
export function initLocal(workspace: Workspace) {
  // required to make sure nrwl/workspace import works
  if (workspace.type === 'nx') {
    require(path.join(
      workspace.dir,
      'node_modules',
      '@nrwl',
      'tao',
      'src',
      'compat',
      'compat.js'
    ));
  }

  // The commandsObject is a Yargs object declared in `nx-commands.ts`,
  // It is exposed and bootstrapped here to provide CLI features.
  const w = require('@nrwl/workspace');
  if (w.supportedNxCommands.includes(process.argv[2])) {
    w.commandsObject.argv;
  } else if (workspace.type === 'nx') {
    require(path.join(
      workspace.dir,
      'node_modules',
      '@nrwl',
      'tao',
      'index.js'
    ));
  } else if (workspace.type === 'angular') {
    w.output.note({
      title: `Nx didn't recognize the command, forwarding on to the Angular CLI.`
    });
    require(path.join(
      workspace.dir,
      'node_modules',
      '@angular',
      'cli',
      'lib',
      'init.js'
    ));
  }
}
