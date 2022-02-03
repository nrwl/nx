import { Workspaces } from '@nrwl/tao/src/shared/workspace';
import { getPackageManagerCommand } from '@nrwl/tao/src/shared/package-manager';

import { performance } from 'perf_hooks';
import { execSync } from 'child_process';

import { Workspace } from './workspace';
import { parseRunOneOptions } from './parse-run-one-options';

/**
 * Nx is being run inside a workspace.
 *
 * @param workspace Relevant local workspace properties
 */
process.env.NX_CLI_SET = 'true';

export function initLocal(workspace: Workspace) {
  try {
    performance.mark('init-local');
    //nx-ignore-next-line
    require('@nrwl/workspace/src/utilities/perf-logging');

    const supportedNxCommands =
      //nx-ignore-next-line
      require('@nrwl/workspace/src/command-line/supported-nx-commands').supportedNxCommands;

    if (supportedNxCommands.includes(process.argv[2])) {
      // required to make sure nrwl/workspace import works
      //nx-ignore-next-line
      require('@nrwl/workspace/src/command-line/nx-commands').commandsObject
        .argv;
      return;
    }

    if (generating()) {
      loadCli(workspace, '@nrwl/tao/index.js');
      return;
    }

    const runOpts = runOneOptions(workspace);
    const running = runOpts !== false;
    if (running) {
      //nx-ignore-next-line
      require('@nrwl/workspace/src/command-line/run-one').runOne(runOpts);
      return;
    }

    if (workspace.type === 'nx') {
      loadCli(workspace, '@nrwl/tao/index.js');
    } else {
      if (
        process.argv[2] === 'update' &&
        process.env.FORCE_NG_UPDATE != 'true'
      ) {
        console.log(
          `Nx provides a much improved version of "ng update". It runs the same migrations, but allows you to:`
        );
        console.log(`- rerun the same migration multiple times`);
        console.log(`- reorder migrations, skip migrations`);
        console.log(`- fix migrations that "almost work"`);
        console.log(`- commit a partially migrated state`);
        console.log(
          `- change versions of packages to match organizational requirements`
        );
        console.log(
          `And, in general, it is lot more reliable for non-trivial workspaces. Read more at: https://nx.dev/latest/angular/workspace/update`
        );
        console.log(
          `Run "nx migrate latest" to update to the latest version of Nx.`
        );
        console.log(
          `Running "ng update" can still be useful in some dev workflows, so we aren't planning to remove it.`
        );
        console.log(
          `If you need to use it, run "FORCE_NG_UPDATE=true ng update".`
        );
      } else if (
        (process.argv[2] === 'add' || process.argv[3] === 'add') &&
        process.env.FORCE_NG_ADD != 'true'
      ) {
        console.log('Ng add is not natively supported by Nx');
        const pkg =
          process.argv[2] === 'add' ? process.argv[3] : process.argv[4];
        if (!pkg) {
          process.exit(1);
        }

        const pm = getPackageManagerCommand();
        const cmd = `${pm.add} ${pkg} && ${pm.exec} nx g ${pkg}:ng-add`;
        console.log(`Instead, we recommend running \`${cmd}\``);

        import('enquirer').then((x) =>
          x
            .prompt<{ c: boolean }>({
              name: 'c',
              type: 'confirm',
              message: 'Run this command?',
            })
            .then(({ c }) => {
              if (c) {
                execSync(cmd, { stdio: 'inherit' });
              }
            })
        );
      } else {
        loadCli(workspace, '@angular/cli/lib/init.js');
      }
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
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
  const workspaceConfig = new Workspaces(
    workspace.dir
  ).readWorkspaceConfiguration();

  return parseRunOneOptions(
    workspace.dir,
    workspaceConfig,
    process.argv.slice(2)
  );
}

function generating(): boolean {
  const command = process.argv.slice(2)[0];
  return command === 'g' || command === 'generate';
}
