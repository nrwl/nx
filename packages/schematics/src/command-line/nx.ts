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
    'affected:apps      [SHA1] [SHA2]',
    'Print applications affected by changes',
    withAffectedOptions,
    () => affected(['apps', ...process.argv])
  )
  .command(
    'affected:build     [SHA1] [SHA2]',
    'Build applications affected by changes',
    withAffectedOptions,
    () => affected(['build', ...process.argv])
  )
  .command(
    'affected:e2e       [SHA1] [SHA2]',
    'Test  applications affected by changes',
    withAffectedOptions,
    () => affected(['e2e', ...process.argv])
  )
  .command(
    'affected:dep-graph [SHA1] [SHA2]',
    'Graph depedencies affected by changes',
    yargs => withAffectedOptions(withDepGraphOptions(yargs)),
    () => affected(['dep-graph', ...process.argv])
  )
  .command(
    'dep-graph',
    'Graph depedencies within workspace',
    yargs => withAffectedOptions(withDepGraphOptions(yargs)),
    args => generateGraph(args)
  )
  .command(
    'format:check',
    'Check for un-formated files',
    withAffectedOptions,
    _ => format(['check', ...process.argv])
  )
  .command(
    'format:write',
    'Overwrite un-formatted files',
    withAffectedOptions,
    _ => format(['write', ...process.argv])
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
    'Generate a custom schematic that can be run via `ng g <name>`',
    yargs =>
      yargs
        .positional('name', {
          type: 'string',
          describe: 'The name of your schematic`'
        })
        .option('directory', { type: 'string' }),
    () => workspaceSchematic(process.argv.slice(3))
  )
  .help('help')
  .version()
  .option('quiet', { type: 'boolean', hidden: true })
  .strict()
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
    .group(
      ['files', 'uncommitted', 'untracked'],
      'Run command using [SHA1] [SHA2] or via:'
    )
    .implies('SHA1', 'SHA2')
    .nargs('uncommitted', 0)
    .nargs('untracked', 0)
    .conflicts({
      SHA1: ['files', 'untracked', 'uncommitted'],
      files: ['uncommitted', 'untracked'],
      untracked: ['uncommitted', 'files'],
      uncommitted: ['files', 'untracked']
    });
}

function withDepGraphOptions(yargs: yargs.Argv): yargs.Argv {
  return yargs
    .demandOption(['file'])
    .describe('file', 'output file (e.g. --file=.vis/output.json)')
    .choices('output', [OutputType.json, OutputType.dot, OutputType.html]);
}
