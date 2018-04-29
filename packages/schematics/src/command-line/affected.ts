import { execSync } from 'child_process';
import { getAffectedApps, getAffectedProjects, parseFiles } from './shared';
import * as path from 'path';
import * as resolve from 'resolve';
import * as runAll from 'npm-run-all';
import * as yargs from 'yargs';
import * as yargsParser from 'yargs-parser';
import { GlobalNxArgs } from './nx';
import { generateGraph } from './dep-graph';

export interface YargsAffectedOptions extends yargs.Arguments {}

export interface AffectedOptions extends GlobalNxArgs {
  parallel: boolean;
  untracked: boolean;
  uncommitted: boolean;
  base: string;
  head: string;
  exclude: string[];
  files: string[];
}

export function affected(
  command: string,
  parsedArgs: YargsAffectedOptions,
  args: string[]
): void {
  let apps: string[];
  let projects: string[];
  let rest: string[];

  try {
    const p = parseFiles(args);
    rest = p.rest;
    apps = getAffectedApps(p.files).filter(
      app => !parsedArgs.exclude.includes(app)
    );
    projects = getAffectedProjects(p.files);
  } catch (e) {
    printError(command, e);
    process.exit(1);
  }

  switch (command) {
    case 'apps':
      console.log(apps.join(' '));
      break;
    case 'build':
      build(apps, parsedArgs);
      break;
    case 'e2e':
      e2e(apps, parsedArgs);
      break;
    case 'dep-graph':
      generateGraph(yargsParser(rest), projects);
      break;
  }
}

function printError(command: string, e: any) {
  console.error(e.message);
}

function build(apps: string[], parsedArgs: YargsAffectedOptions) {
  if (apps.length > 0) {
    const buildCommands = filterNxSpecificArgs(parsedArgs);
    let message = `Building ${apps.join(', ')}`;
    if (buildCommands.length > 0) {
      message += ` with flags: ${buildCommands.join(' ')}`;
    }
    console.log(message);

    if (parsedArgs.parallel) {
      runAll(
        apps.map(app => `ng build -- --app ${app} ${buildCommands.join(' ')}`),
        {
          parallel: true,
          stdin: process.stdin,
          stdout: process.stdout,
          stderr: process.stderr
        }
      )
        .then(() => console.log('Build succeeded.'))
        .catch(err => console.error('Build failed.', err));
    } else {
      apps.forEach(app => {
        execSync(
          `node ${ngPath()} build ${buildCommands.join(' ')} -a=${app}`,
          {
            stdio: [0, 1, 2]
          }
        );
      });
    }
  } else {
    console.log('No apps to build');
  }
}

function e2e(apps: string[], parsedArgs: YargsAffectedOptions) {
  if (apps.length > 0) {
    console.log(`Testing ${apps.join(', ')}`);

    const args = filterNxSpecificArgs(parsedArgs);

    apps.forEach(app => {
      execSync(`node ${ngPath()} e2e ${args.join(' ')} -a=${app}`, {
        stdio: [0, 1, 2]
      });
    });
  } else {
    console.log('No apps to test');
  }
}

function filterNxSpecificArgs(parsedArgs: YargsAffectedOptions): string[] {
  const filteredArgs = { ...parsedArgs };
  // Delete Nx arguments from parsed Args
  nxSpecificFlags.forEach(flag => {
    delete filteredArgs[flag];
  });

  // These would be arguments such as app2 in  --app app1 app2 which the CLI does not accept
  delete filteredArgs._;
  // Also remove the node path
  delete filteredArgs.$0;

  // Re-serialize into a list of args
  return Object.keys(filteredArgs).map(filteredArg => {
    if (!Array.isArray(filteredArgs[filteredArg])) {
      filteredArgs[filteredArg] = [filteredArgs[filteredArg]];
    }

    return filteredArgs[filteredArg]
      .map(value => {
        return `--${filteredArg}=${value}`;
      })
      .join(' ');
  });
}

function ngPath() {
  const basePath = path.dirname(
    path.dirname(
      path.dirname(resolve.sync('@angular/cli', { basedir: __dirname }))
    )
  );
  return path.join(basePath, 'bin', 'ng');
}

/**
 * These options are only for getting an array with properties of AffectedOptions.
 *
 * @remark They are not defaults or useful for anything else
 */
const dummyOptions: AffectedOptions = {
  parallel: false,
  untracked: false,
  uncommitted: false,
  help: false,
  version: false,
  quiet: false,
  base: 'base',
  head: 'head',
  exclude: ['exclude'],
  files: ['']
};

const nxSpecificFlags = Object.keys(dummyOptions);
