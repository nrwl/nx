import * as path from 'path';
import * as fs from 'fs';
import { Workspace } from './workspace';
import { parseRunOneOptions } from './parse-run-one-options';
import { useNxToRunNxBuilderOrGenerator } from './use-nx-to-run-nx-builder-or-generator';

/**
 * Nx is being run inside a workspace.
 *
 * @param workspace Relevant local workspace properties
 */
process.env.NX_CLI_SET = 'true';

export function initLocal(workspace: Workspace) {
  require('@nrwl/workspace/' + 'src/utils/perf-logging');
  const supportedNxCommands = require('@nrwl/workspace/' +
    'src/command-line/supported-nx-commands').supportedNxCommands;
  const runOpts = runOneOptions(workspace);

  if (supportedNxCommands.includes(process.argv[2])) {
    // required to make sure nrwl/workspace import works
    if (workspace.type === 'nx') {
      require('@nrwl/tao/src/compat/compat.js');
    }
    require('@nrwl/workspace' + '/src/command-line/nx-commands').commandsObject
      .argv;
  } else {
    // not using the tasks runner
    if (runOpts === false || process.env.NX_SKIP_TASKS_RUNNER) {
      loadCli(workspace, useNxToRunNxBuilderOrGenerator());
    } else {
      require('@nrwl/workspace' + '/src/command-line/run-one').runOne(runOpts);
    }
  }
}

function loadCli(workspace: Workspace, useNxCli: boolean) {
  let cliPath: string;
  if (workspace.type === 'nx' || useNxCli) {
    cliPath = '@nrwl/tao/index.js';
  } else if (workspace.type === 'angular') {
    cliPath = '@angular/cli/lib/init.js';
  } else {
    console.error(`Cannot recognize the workspace type.`);
    process.exit(1);
  }

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
