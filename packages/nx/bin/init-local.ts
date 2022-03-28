import { getPackageManagerCommand } from '../src/utils/package-manager';

import { performance } from 'perf_hooks';
import { execSync } from 'child_process';

import { commandsObject } from '../src/command-line/nx-commands';
import { WorkspaceTypeAndRoot } from '../src/utils/find-workspace-root';

/**
 * Nx is being run inside a workspace.
 *
 * @param workspace Relevant local workspace properties
 */
process.env.NX_CLI_SET = 'true';

export function initLocal(workspace: WorkspaceTypeAndRoot) {
  try {
    performance.mark('init-local');
    require('nx/src/utils/perf-logging');

    if (workspace.type !== 'nx' && shouldDelegateToAngularCLI()) {
      handleAngularCLIFallbacks(workspace);
      return;
    }

    if (isKnownCommand()) {
      commandsObject.argv;
    } else {
      const newArgs = rewritePositionalArguments();
      commandsObject.parse(newArgs);
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

function rewritePositionalArguments() {
  if (!process.argv[3] || process.argv[3].startsWith('-')) {
    return [
      'run',
      `${wrapIntoQuotesIfNeeded(process.argv[2])}`,
      ...process.argv.slice(3),
    ];
  } else {
    return [
      'run',
      `${process.argv[3]}:${wrapIntoQuotesIfNeeded(process.argv[2])}`,
      ...process.argv.slice(4),
    ];
  }
}

function wrapIntoQuotesIfNeeded(arg: string) {
  return arg.indexOf(':') > -1 ? `"${arg}"` : arg;
}

function isKnownCommand() {
  const commands = [
    ...Object.keys(
      (commandsObject as any)
        .getInternalMethods()
        .getCommandInstance()
        .getCommandHandlers()
    ),
    'g',
    'dep-graph',
    'affected:dep-graph',
    'format',
    'workspace-schematic',
    'clear-cache',
    'help',
  ];
  return (
    !process.argv[2] ||
    process.argv[2].startsWith('-') ||
    commands.indexOf(process.argv[2]) > -1
  );
}

function shouldDelegateToAngularCLI() {
  const command = process.argv[2];
  const commands = ['add', 'analytics', 'deploy', 'config', 'doc', 'update'];
  return commands.indexOf(command) > -1;
}

function handleAngularCLIFallbacks(workspace: WorkspaceTypeAndRoot) {
  if (process.argv[2] === 'update' && process.env.FORCE_NG_UPDATE != 'true') {
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
      `And, in general, it is lot more reliable for non-trivial workspaces. Read more at: https://nx.dev/getting-started/nx-and-angular#ng-update-and-nx-migrate`
    );
    console.log(
      `Run "nx migrate latest" to update to the latest version of Nx.`
    );
    console.log(
      `Running "ng update" can still be useful in some dev workflows, so we aren't planning to remove it.`
    );
    console.log(`If you need to use it, run "FORCE_NG_UPDATE=true ng update".`);
  } else if (process.argv[2] === 'add') {
    console.log('Ng add is not natively supported by Nx');
    const pkg = process.argv[2] === 'add' ? process.argv[3] : process.argv[4];
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
    require('nx/src/adapter/compat');
    try {
      const cli = require.resolve('@angular/cli/lib/init.js', {
        paths: [workspace.dir],
      });
      require(cli);
    } catch (e) {
      console.error(
        `Could not find '@angular/cli/lib/init.js' module in this workspace.`,
        e
      );
      process.exit(1);
    }
  }
}
