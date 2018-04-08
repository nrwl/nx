import * as yargsParser from 'yargs-parser';

import { readJsonFile } from './fileutils';
import * as path from 'path';

const globalArgsConfig = {
  alias: {
    app: ['a'],
    appRoot: ['r']
  },
  string: ['app'],
  normalize: ['app-root'],
  coerce: {
    appRoot: arg => path.resolve(arg)
  }
};

export type GlobalUserOptions = {
  app?: string;
  appRoot?: string;
  command: string;
};

export function getAppDirectoryUsingCliConfig() {
  const cli = readJsonFile(process.cwd() + '/.angular-cli.json');

  const appName = parseArgs().app;

  if (appName) {
    const app = cli.apps.find(a => a.name === appName);
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
  if (parseArgs().app) {
    console.error('Nx only supports running unit tests for all apps and libs.');
    console.error('You cannot use -a or --app.');
    console.error('Use fdescribe or fit to select a subset of tests to run.');
    process.exit(1);
  }
}

export function parseArgs(): GlobalUserOptions {
  const processedArgs = yargsParser(process.argv, globalArgsConfig);
  return {
    ...processedArgs,
    command: processedArgs._[2]
  };
}
