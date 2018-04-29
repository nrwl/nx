import { execSync } from 'child_process';
import { getAffectedApps, getAffectedProjects, parseFiles } from './shared';
import * as path from 'path';
import * as resolve from 'resolve';
import * as runAll from 'npm-run-all';
import * as yargsParser from 'yargs-parser';
import { generateGraph } from './dep-graph';

export function affected(
  command: string,
  parsedArgs: any,
  args: string[]
): void {
  let apps: string[];
  let projects: string[];
  let rest: string[];

  try {
    const p = parseFiles(args);
    rest = p.rest;
    apps = getAffectedApps(p.files);
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
      build(apps, rest, parsedArgs.parallel);
      break;
    case 'e2e':
      e2e(apps, rest);
      break;
    case 'dep-graph':
      generateGraph(yargsParser(rest), projects);
      break;
  }
}

function printError(command: string, e: any) {
  console.error(e.message);
}

function build(apps: string[], rest: string[], parallel: boolean) {
  if (apps.length > 0) {
    console.log(`Building ${apps.join(', ')}`);

    const buildCommands = filterNxSpecificArgs(rest);
    runAll(apps.map(app => `ng build ${buildCommands.join(' ')} -a=${app}`), {
      parallel,
      stdin: process.stdin,
      stdout: process.stdout,
      stderr: process.stderr
    })
      .then(() => console.log('Build succeeded.'))
      .catch(err => console.error('Build failed.'));
  } else {
    console.log('No apps to build');
  }
}

function e2e(apps: string[], rest: string[]) {
  if (apps.length > 0) {
    console.log(`Testing ${apps.join(', ')}`);

    rest = filterNxSpecificArgs(rest);

    apps.forEach(app => {
      execSync(`node ${ngPath()} e2e ${rest.join(' ')} -a=${app}`, {
        stdio: [0, 1, 2]
      });
    });
  } else {
    console.log('No apps to test');
  }
}

function filterNxSpecificArgs(args: string[]): string[] {
  const nxSpecificFlags = [
    '--parallel',
    '--no-parallel',
    '--base',
    '--head',
    '--files',
    '--uncommitted',
    '--untracked'
  ];

  return args.filter(
    arg => !nxSpecificFlags.some(flag => arg.startsWith(flag))
  );
}

function ngPath() {
  const basePath = path.dirname(
    path.dirname(
      path.dirname(resolve.sync('@angular/cli', { basedir: __dirname }))
    )
  );
  return path.join(basePath, 'bin', 'ng');
}
