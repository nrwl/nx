#!/usr/bin/env node
import * as yargs from 'yargs';

import { affected } from './affected';
import { format } from './format';
import { update } from './update';
import { patchNg } from './patch-ng';
import { lint } from './lint';
import { workspaceSchematic } from './workspace-schematic';
import { generateGraph, OutputType } from './dep-graph';

const noop = (yargs: yargs.Argv): yargs.Argv => yargs;

yargs
  .usage('Nrwl Extensions for Angular')
  .command(
    'affected:apps',
    'Print applications affected by changes',
    withAffectedOptions,
    () => affected(['apps', ...process.argv.slice(3)])
  )
  .command(
    'affected:build',
    'Build applications affected by changes',
    withAffectedOptions,
    () => affected(['build', ...process.argv.slice(3)])
  )
  .command(
    'affected:e2e',
    'Test  applications affected by changes',
    withAffectedOptions,
    () => affected(['e2e', ...process.argv.slice(3)])
  )
  .command(
    'affected:dep-graph',
    'Graph dependencies affected by changes',
    yargs => withAffectedOptions(withDepGraphOptions(yargs)),
    () => affected(['dep-graph', ...process.argv.slice(3)])
  )
  .command(
    'dep-graph',
    'Graph dependencies within workspace',
    yargs => withAffectedOptions(withDepGraphOptions(yargs)),
    args => generateGraph(args)
  )
  .command(
    'format:check',
    'Check for un-formatted files',
    withAffectedOptions,
    _ => format(['check', ...process.argv.slice(3)])
  )
  .command(
    'format:write',
    'Overwrite un-formatted files',
    withAffectedOptions,
    _ => format(['write', ...process.argv.slice(3)])
  )
  .alias('format:write', 'format')
  .command('lint [files..]', 'Lint workspace or list of files', noop, _ =>
    lint()
  )
  .command('update:check', 'Check for workspace updates', noop, _ =>
    update(['check'])
  )
  .command('update:skip', 'Skip workspace updates', noop, _ => update(['skip']))
  .command('update', 'Update workspace', noop, _ => update([]))
  .alias('update', 'migrates') // TODO: Remove after 1.0
  .command('postinstall', false, noop, _ => {
    patchNg();
    update(['check']);
  })
  .command(
    'workspace-schematic <name>',
    'Runs a workspace schematic from the tools/schematics directory',
    yargs =>
      yargs.positional('name', {
        type: 'string',
        describe: 'The name of your schematic`'
      }),
    () => workspaceSchematic(process.argv.slice(3))
  )
  .help('help')
  .version()
  .option('quiet', { type: 'boolean', hidden: true })
  .demandCommand().argv; // .argv bootstraps the CLI creation;

function withAffectedOptions(yargs: yargs.Argv): yargs.Argv {
  return yargs
    .option('files', {
      describe: 'A list of files delimited by commas',
      type: 'array',
      requiresArg: true
    })
    .option('uncommitted', { describe: 'Uncommitted changes' })
    .option('untracked', { describe: 'Untracked changes' })
    .option('base', {
      describe: 'Base of the current branch (usually master)',
      type: 'string',
      requiresArg: true
    })
    .option('head', {
      describe: 'Latest commit of the current branch (usually HEAD)',
      type: 'string',
      requiresArg: true
    })
    .group(['base', 'head'], 'Run command using --base=[SHA1] --head=[SHA2]:')
    .group(['files', 'uncommitted', 'untracked'], 'or using:')
    .implies('SHA1', 'SHA2')
    .implies('head', 'base')
    .implies('base', 'head')
    .nargs('uncommitted', 0)
    .nargs('untracked', 0)
    .conflicts({
      SHA1: ['files', 'untracked', 'uncommitted', 'base', 'head'],
      files: ['uncommitted', 'untracked', 'base', 'head'],
      untracked: ['uncommitted', 'files', 'base', 'head'],
      uncommitted: ['files', 'untracked', 'base', 'head']
    });
}

function withDepGraphOptions(yargs: yargs.Argv): yargs.Argv {
  return yargs
    .describe('file', 'output file (e.g. --file=.vis/output.json)')
    .choices('output', [OutputType.json, OutputType.dot, OutputType.html]);
}
