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
    if (runOpts === false || process.env.NX_SKIP_TASKS_RUNNER) {
      if (workspace.type === 'angular' && process.argv[2] === 'update') {
        console.log(
          `Nx provides a much improved version of "ng update". It runs the same migrations, but allows you to:`
        );
        console.log(`- rerun the same migration multiple times`);
        console.log(`- reorder migrations`);
        console.log(`- skip migrations`);
        console.log(`- fix migrations that "almost work"`);
        console.log(`- commit a partially migrated state`);
        console.log(`- change versions of packages to match org requirements`);
        console.log(
          `And, in general, it is lot more reliable for non-trivial workspaces. Read more at: https://nx.dev/latest/angular/workspace/update`
        );
        console.log(
          `Run "nx migrate latest" to update to the latest version of Nx.`
        );
      } else {
        loadCli(workspace);
      }
    } else {
      require('@nrwl/workspace' + '/src/command-line/run-one').runOne(runOpts);
    }
  }
}

function loadCli(workspace: Workspace) {
  let cliPath: string;
  if (workspace.type === 'nx') {
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
    const nxJson = JSON.parse(
      fs.readFileSync(path.join(workspace.dir, 'nx.json')).toString()
    );

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

    return parseRunOneOptions(
      nxJson,
      workspaceConfigJson,
      process.argv.slice(2)
    );
  } catch (e) {
    return false;
  }
}
