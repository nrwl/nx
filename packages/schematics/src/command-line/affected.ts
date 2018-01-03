import { execSync } from 'child_process';
import { getAffectedApps, parseFiles } from './shared';

const command = process.argv[2];
let apps: string[];
let rest: string[];

try {
  const p = parseFiles();
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

function printError(command: string, e: any) {
  console.error(`Pass the SHA range, as follows: npm run affected:${command} -- SHA1 SHA2.`);
  console.error(
    `Or pass the list of files, as follows: npm run affected:${command} --files="libs/mylib/index.ts,libs/mylib2/index.ts".`
  );
  console.error(e.message);
}

function build(apps: string[], rest: string[]) {
  if (apps.length > 0) {
    console.log(`Building ${apps.join(', ')}`);
    apps.forEach(app => {
      execSync(`ng build ${rest.join(' ')} -a=${app}`, { stdio: [0, 1, 2] });
    });
  } else {
    console.log('No apps to build');
  }
}

function e2e(apps: string[], rest: string[]) {
  if (apps.length > 0) {
    console.log(`Testing ${apps.join(', ')}`);
    apps.forEach(app => {
      execSync(`ng e2e ${rest.join(' ')} -a=${app}`, { stdio: [0, 1, 2] });
    });
  } else {
    console.log('No apps to tst');
  }
}
