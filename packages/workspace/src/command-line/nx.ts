#!/usr/bin/env node
import { commandsObject } from '@nrwl/workspace';

export interface GlobalNxArgs {
  help?: boolean;
  version?: boolean;
  quiet?: boolean;
}

/**
 * The commandsObject is a Yargs object declared in `nx-commands.ts`,
 * It is exposed and bootstrapped here to provide CLI features.
 */
commandsObject.argv; // .argv bootstraps the CLI creation;
