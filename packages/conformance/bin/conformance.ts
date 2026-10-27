#!/usr/bin/env node

import { NX_VERSION } from '@nx/devkit';
import { gte } from 'semver';
import * as yargs from 'yargs';

if (gte(NX_VERSION, '19.8.0')) {
  console.error(
    `Error: This command is only intended to be used as a fallback for legacy Nx 18 and 19 versions, but you have Nx version "${NX_VERSION}" installed.
Please run \`nx conformance\` directly instead.`
  );
  process.exit(1);
}

yargs.wrap(yargs.terminalWidth());

yargs
  .parserConfiguration({
    'strip-dashed': true,
  })
  .command(resolveCommand())
  .scriptName('nx conformance')
  .parse();

function resolveCommand() {
  const {
    yargsConformanceCommand,
  } = require('../src/commands/conformance/command-object');
  // Modify the command to run as the default in this case to prevent any arguments being required
  yargsConformanceCommand.command = '$0';
  return yargsConformanceCommand;
}
