import { execSync } from 'child_process';
import { getAffectedApps, parseFiles } from './shared';
import * as path from 'path';
import * as resolve from 'resolve';
import * as runAll from 'npm-run-all';
import * as yargsParser from 'yargs-parser';

export function affected(args: string[]): void {
  const command = args[0];
  let apps: string[];
  let rest: string[];
  try {
    const p = parseFiles(args.slice(1));
    rest = p.rest;
    apps = getAffectedApps(p.files);
  } catch (e) {
    printError(command, e);
    process.exit(1);
  }

  switch (command) {
    case 'apps':
      console.log(apps.join(' '));
      break;
    case 'build':
      build(apps, rest);
      break;
    case 'e2e':
      e2e(apps, rest);
      break;
  }
}

function printError(command: string, e: any) {
  console.error(
    `Pass the SHA range, as follows: npm run affected:${command} -- SHA1 SHA2.`
  );
  console.error(
    `Or pass the list of files, as follows: npm run affected:${command} -- --files="libs/mylib/index.ts,libs/mylib2/index.ts".`
  );
  console.error(
    `Or to get the list of files from staged or unstaged changes: npm run affected:${command} -- staged | unstaged".`
  );
  console.error(e.message);
}

function build(apps: string[], rest: string[]) {
  if (apps.length > 0) {
    const parallel = yargsParser(rest, {
      default: {
        parallel: true
      },
      boolean: ['parallel']
    }).parallel;

    console.log(`Building ${apps.join(', ')}`);
    const buildCommands = rest.filter(a => !a.startsWith('--parallel'));
    runAll(
      apps.map(app => `ng build -- ${buildCommands.join(' ')} -a=${app}`),
      {
        parallel,
        stdin: process.stdin,
        stdout: process.stdout,
        stderr: process.stderr
      }
    )
      .then(() => console.log('Build succeeded.'))
      .catch(err => console.error('Build failed.'));
  } else {
    console.log('No apps to build');
  }
}

function e2e(apps: string[], rest: string[]) {
  if (apps.length > 0) {
    console.log(`Testing ${apps.join(', ')}`);
    apps.forEach(app => {
      execSync(`node ${ngPath()} e2e ${rest.join(' ')} -a=${app}`, {
        stdio: [0, 1, 2]
      });
    });
  } else {
    console.log('No apps to test');
  }
}

function ngPath() {
  const basePath = path.dirname(
    path.dirname(
      path.dirname(resolve.sync('@angular/cli', { basedir: __dirname }))
    )
  );
  return path.join(basePath, 'bin', 'ng');
}
