import * as path from 'path';
import * as fs from 'fs';
import { Workspace } from './workspace';
import { parseRunOneOptions } from './parse-run-one-options';

/**
 * Nx is being run inside a workspace.
 *
 * @param workspace Relevant local workspace properties
 */
process.env.NX_CLI_SET = 'true';

export function initLocal(workspace: Workspace) {
  require('@nrwl/workspace/' + 'src/utils/perf-logging');
  require('@nrwl/tao/src/compat/compat.js');

  const supportedNxCommands = require('@nrwl/workspace/' +
    'src/command-line/supported-nx-commands').supportedNxCommands;

  const runOpts = runOneOptions(workspace);
  const running = runOpts !== false;

  if (supportedNxCommands.includes(process.argv[2])) {
    // required to make sure nrwl/workspace import works
    require('@nrwl/workspace' + '/src/command-line/nx-commands').commandsObject
      .argv;
  } else if (running) {
    require('@nrwl/workspace' + '/src/command-line/run-one').runOne(runOpts);
  } else if (generating()) {
    loadCli(workspace, '@nrwl/tao/index.js');
  } else {
    if (workspace.type === 'nx') {
      loadCli(workspace, '@nrwl/tao/index.js');
    } else {
      loadCli(workspace, '@angular/cli/lib/init.js');
    }
  }
}

function loadCli(workspace: Workspace, cliPath: string) {
  try {
    const cli = require.resolve(cliPath, { paths: [workspace.dir] });
    require(cli);
  } catch (e) {
    console.error(`Could not find ${cliPath} module in this workspace.`, e);
    process.exit(1);
  }
}

function runOneOptions(
  workspace: Workspace
): false | { project; target; configuration; parsedArgs } {
  try {
    const workspaceConfigJson = JSON.parse(
      fs
        .readFileSync(
          path.join(
            workspace.dir,
            workspace.type === 'nx' ? 'workspace.json' : 'angular.json'
          )
        )
        .toString()
    );

    return parseRunOneOptions(workspaceConfigJson, process.argv.slice(2));
  } catch (e) {
    return false;
  }
}

function generating(): boolean {
  const command = process.argv.slice(2)[0];
  return command === 'g' || command === 'generate';
}
