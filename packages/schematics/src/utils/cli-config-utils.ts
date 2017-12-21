import * as fs from 'fs';

export function getAppDirectoryUsingCliConfig() {
  const appArg = findAppArg();
  const cli = JSON.parse(fs.readFileSync(process.cwd() + '/.angular-cli.json', 'UTF-8'));

  if (appArg) {
    const appName = appArg.split('=')[1];
    const app = cli.apps.filter(a => a.name === appName)[0];
    if (!app) {
      console.error(`Cannot find app '${appName}'.`);
      process.exit(1);
    } else if (app.root.startsWith('libs')) {
      console.error(`Cannot run e2e tests for a library.`);
      process.exit(1);
    } else {
      return `apps/${appName}`;
    }
  } else {
    console.error(`Please provide the app name using --app or -a.`);
    process.exit(1);
  }
}

export function makeSureNoAppIsSelected() {
  if (findAppArg()) {
    console.error('Nx only supports running unit tests for all apps and libs.');
    console.error('You cannot use -a or --app.');
    console.error('Use fdescribe or fit to select a subset of tests to run.');
    process.exit(1);
  }
}

function findAppArg() {
  return process.argv.filter(
    a =>
      a.startsWith(`-a=`) ||
      a.startsWith(`--app=`) ||
      a.startsWith(`"-a="`) ||
      a.startsWith(`"--app="`) ||
      a.startsWith(`'-a='`) ||
      a.startsWith(`'--app='`)
  )[0];
}
