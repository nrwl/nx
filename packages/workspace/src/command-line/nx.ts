#!/usr/bin/env node
import { commandsObject, supportedNxCommands } from './nx-commands';
import { closestCli } from '../utils/app-root';

export interface GlobalNxArgs {
  help?: boolean;
  version?: boolean;
  quiet?: boolean;
}

if (supportedNxCommands.includes(process.argv[2])) {
  // The commandsObject is a Yargs object declared in `nx-commands.ts`,
  // It is exposed and bootstrapped here to provide CLI features.
  commandsObject.argv; // .argv bootstraps the CLI creation;
} else {
  require(closestCli(__dirname));
}
