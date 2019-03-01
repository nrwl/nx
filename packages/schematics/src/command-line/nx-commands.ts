#!/usr/bin/env node
import * as yargs from 'yargs';

import { affected } from './affected';
import { format } from './format';
import { update } from './update';
import { lint } from './lint';
import { workspaceSchematic } from './workspace-schematic';
import { generateGraph, OutputType } from './dep-graph';

const noop = (yargs: yargs.Argv): yargs.Argv => yargs;

/**
 * Exposing the Yargs commands object so the documentation generator can
 * parse it. The CLI will consume it and call the `.argv` to bootstrapped
 * the CLI. These command declarations needs to be in a different file
 * from the `.argv` call, so the object and it's relative scripts can
 * be executed correctly.
 */
export const commandsObject = yargs
  .usage('Angular CLI power-ups for modern Web development')
  .command(
    'affected',
    'Run task for affected projects',
    yargs => withAffectedOptions(withParallel(yargs)),
    args => affected(args)
  )
  .command(
    'affected:apps',
    'Print applications affected by changes',
    withAffectedOptions,
    args =>
      affected({
        ...args,
        target: 'apps'
      })
  )
  .command(
    'affected:libs',
    'Print libraries affected by changes',
    withAffectedOptions,
    args =>
      affected({
        ...args,
        target: 'libs'
      })
  )
  .command(
    'affected:build',
    'Build applications and publishable libraries affected by changes',
    yargs => withAffectedOptions(withParallel(yargs)),
    args =>
      affected({
        ...args,
        target: 'build'
      })
  )
  .command(
    'affected:test',
    'Test projects affected by changes',
    yargs => withAffectedOptions(withParallel(yargs)),
    args =>
      affected({
        ...args,
        target: 'test'
      })
  )
  .command(
    'affected:e2e',
    'Run e2e tests for the applications affected by changes',
    withAffectedOptions,
    args =>
      affected({
        ...args,
        target: 'e2e'
      })
  )
  .command(
    'affected:dep-graph',
    'Graph dependencies affected by changes',
    yargs => withAffectedOptions(withDepGraphOptions(yargs)),
    args =>
      affected({
        ...args,
        target: 'dep-graph'
      })
  )
  .command(
    'affected:lint',
    'Lint projects affected by changes',
    yargs => withAffectedOptions(withParallel(yargs)),
    args =>
      affected({
        ...args,
        target: 'lint'
      })
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
    withFormatOptions,
    args => format('check', args)
  )
  .command(
    'format:write',
    'Overwrite un-formatted files',
    withFormatOptions,
    args => format('write', args)
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
  .command(
    'workspace-schematic [name]',
    'Runs a workspace schematic from the tools/schematics directory',
    yargs => {
      yargs.option('list-schematics', {
        describe: 'List the available workspace-schematics',
        type: 'boolean'
      });
      /**
       * Don't require `name` if only listing available
       * schematics
       */
      if (yargs.argv.listSchematics !== true) {
        yargs.demandOption(['name']).positional('name', {
          type: 'string',
          describe: 'The name of your schematic`'
        });
      }
      return yargs;
    },
    () => workspaceSchematic(process.argv.slice(3))
  )
  .help('help')
  .version()
  .option('quiet', { type: 'boolean', hidden: true })
  .demandCommand();

function withFormatOptions(yargs: yargs.Argv): yargs.Argv {
  return withAffectedOptions(yargs).option('apps-and-libs', {
    type: 'boolean'
  });
}

function withAffectedOptions(yargs: yargs.Argv): yargs.Argv {
  return yargs
    .option('files', {
      describe: 'A list of files delimited by commas',
      type: 'array',
      requiresArg: true,
      coerce: parseCSV
    })
    .option('uncommitted', { describe: 'Uncommitted changes' })
    .option('untracked', { describe: 'Untracked changes' })
    .option('all', { describe: 'All projects' })
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
    .group(
      ['base'],
      'Run command using --base=[SHA1] (affected by the committed, uncommitted and untracked changes):'
    )
    .group(
      ['base', 'head'],
      'or using --base=[SHA1] --head=[SHA2] (affected by the committed changes):'
    )
    .group(['files', 'uncommitted', 'untracked'], 'or using:')
    .implies('head', 'base')
    .nargs('uncommitted', 0)
    .nargs('untracked', 0)
    .nargs('all', 0)
    .option('exclude', {
      describe: 'Exclude certain projects from being processed',
      type: 'array',
      coerce: parseCSV,
      default: []
    })
    .options('only-failed', {
      describe: 'Isolate projects which previously failed',
      type: 'boolean',
      default: false
    })
    .conflicts({
      files: ['uncommitted', 'untracked', 'base', 'head', 'all'],
      untracked: ['uncommitted', 'files', 'base', 'head', 'all'],
      uncommitted: ['files', 'untracked', 'base', 'head', 'all'],
      all: ['files', 'untracked', 'uncommitted', 'base', 'head']
    });
}

function withDepGraphOptions(yargs: yargs.Argv): yargs.Argv {
  return yargs
    .describe('file', 'output file (e.g. --file=.vis/output.json)')
    .choices('output', [
      OutputType.json,
      OutputType.dot,
      OutputType.html,
      OutputType.svg
    ]);
}

function parseCSV(args: string[]) {
  return args
    .map(arg => arg.split(','))
    .reduce(
      (acc, value) => {
        return [...acc, ...value];
      },
      [] as string[]
    );
}

function withParallel(yargs: yargs.Argv): yargs.Argv {
  return yargs
    .option('parallel', {
      describe: 'Parallelize the command',
      type: 'boolean',
      default: false
    })
    .option('maxParallel', {
      describe: 'Max number of parallel processes',
      type: 'number',
      default: 3
    });
}
