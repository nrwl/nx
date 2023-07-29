import { performance } from 'perf_hooks';
import { execSync } from 'child_process';

import { getPackageManagerCommand } from '../src/utils/package-manager';
import { commandsObject } from '../src/command-line/nx-commands';
import { WorkspaceTypeAndRoot } from '../src/utils/find-workspace-root';
import { stripIndents } from '../src/utils/strip-indents';

import * as Mod from 'module';

/**
 * Nx is being run inside a workspace.
 *
 * @param workspace Relevant local workspace properties
 */

export function initLocal(workspace: WorkspaceTypeAndRoot) {
  process.env.NX_CLI_SET = 'true';

  try {
    performance.mark('init-local');
    require('nx/src/utils/perf-logging');

    monkeyPatchRequire();

    if (workspace.type !== 'nx' && shouldDelegateToAngularCLI()) {
      console.warn(
        stripIndents`Using Nx to run Angular CLI commands is deprecated and will be removed in a future version.
        To run Angular CLI commands, use \`ng\`.`
      );
      handleAngularCLIFallbacks(workspace);
      return;
    }

    const command = process.argv[2];
    if (command === 'run' || command === 'g' || command === 'generate') {
      commandsObject.parse(process.argv.slice(2));
    } else if (isKnownCommand(command)) {
      const newArgs = rewriteTargetsAndProjects(process.argv);
      const help = newArgs.indexOf('--help');
      const split = newArgs.indexOf('--');
      if (help > -1 && (split === -1 || split > help)) {
        commandsObject.showHelp();
      } else {
        commandsObject.parse(newArgs);
      }
    } else {
      const newArgs = rewritePositionalArguments(process.argv);
      commandsObject.parse(newArgs);
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

export function rewriteTargetsAndProjects(args: string[]) {
  const newArgs = [args[2]];
  let i = 3;
  while (i < args.length) {
    if (args[i] === '--') {
      return [...newArgs, ...args.slice(i)];
    } else if (
      args[i] === '-p' ||
      args[i] === '--projects' ||
      args[i] === '--exclude' ||
      args[i] === '--files' ||
      args[i] === '-t' ||
      args[i] === '--target' ||
      args[i] === '--targets'
    ) {
      newArgs.push(args[i]);
      i++;
      const items = [];
      while (i < args.length && !args[i].startsWith('-')) {
        items.push(args[i]);
        i++;
      }
      newArgs.push(items.join(','));
    } else {
      newArgs.push(args[i]);
      ++i;
    }
  }
  return newArgs;
}

function rewritePositionalArguments(args: string[]) {
  const relevantPositionalArgs = [];
  const rest = [];
  for (let i = 2; i < args.length; i++) {
    if (!args[i].startsWith('-')) {
      relevantPositionalArgs.push(args[i]);
      if (relevantPositionalArgs.length === 2) {
        rest.push(...args.slice(i + 1));
        break;
      }
    } else {
      rest.push(args[i]);
    }
  }

  if (relevantPositionalArgs.length === 1) {
    return [
      'run',
      `${wrapIntoQuotesIfNeeded(relevantPositionalArgs[0])}`,
      ...rest,
    ];
  }

  return [
    'run',
    `${relevantPositionalArgs[1]}:${wrapIntoQuotesIfNeeded(
      relevantPositionalArgs[0]
    )}`,
    ...rest,
  ];
}

function wrapIntoQuotesIfNeeded(arg: string) {
  return arg.indexOf(':') > -1 ? `"${arg}"` : arg;
}

function isKnownCommand(command: string) {
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
    'connect-to-nx-cloud',
    'clear-cache',
    'help',
  ];
  return !command || command.startsWith('-') || commands.indexOf(command) > -1;
}

function shouldDelegateToAngularCLI() {
  const command = process.argv[2];
  const commands = [
    'add',
    'analytics',
    'config',
    'doc',
    'update',
    'completion',
  ];
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
  } else if (process.argv[2] === 'completion') {
    if (!process.argv[3]) {
      console.log(`"ng completion" is not natively supported by Nx.
  Instead, you could try an Nx Editor Plugin for a visual tool to run Nx commands. If you're using VSCode, you can use the Nx Console plugin, or if you're using WebStorm, you could use one of the available community plugins.
  For more information, see https://nx.dev/core-features/integrate-with-editors`);
    }
  } else {
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

// TODO(v17): Remove this once the @nrwl/* packages are not
function monkeyPatchRequire() {
  const originalRequire = Mod.prototype.require;

  (Mod.prototype.require as any) = function (...args) {
    const modulePath = args[0];
    if (!modulePath.startsWith('@nrwl/')) {
      return originalRequire.apply(this, args);
    } else {
      try {
        // Try the original require
        return originalRequire.apply(this, args);
      } catch (e) {
        if (e.code !== 'MODULE_NOT_FOUND') {
          throw e;
        }

        try {
          // Retry the require with the @nx package
          return originalRequire.apply(
            this,
            args.map((value, i) => {
              if (i !== 0) {
                return value;
              } else {
                return value.replace('@nrwl/', '@nx/');
              }
            })
          );
        } catch {
          // Throw the original error
          throw e;
        }
      }
    }
    // do some side-effect of your own
  };
}
