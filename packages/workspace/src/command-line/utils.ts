import * as yargsParser from 'yargs-parser';
import * as yargs from 'yargs';
import { readNxJson } from '../core/file-utils';
import { output } from '../utilities/output';
import { names } from '@nrwl/devkit';
import type { NxAffectedConfig } from '@nrwl/devkit';

const runOne: string[] = [
  'target',
  'configuration',
  'prod',
  'runner',
  'parallel',
  'max-parallel',
  'exclude',
  'only-failed',
  'help',
  'with-deps',
  'skip-nx-cache',
  'scan',
  'hide-cached-output',
];

const runMany: string[] = [...runOne, 'projects', 'all'];

const runAffected: string[] = [
  ...runOne,
  'untracked',
  'uncommitted',
  'all',
  'base',
  'head',
  'files',
  'plain',
  'select',
];

export interface RawNxArgs extends NxArgs {
  prod?: boolean;
}

export interface NxArgs {
  target?: string;
  configuration?: string;
  runner?: string;
  parallel?: number;
  untracked?: boolean;
  uncommitted?: boolean;
  all?: boolean;
  base?: string;
  head?: string;
  exclude?: string[];
  files?: string[];
  onlyFailed?: boolean;
  'only-failed'?: boolean;
  verbose?: boolean;
  help?: boolean;
  version?: boolean;
  plain?: boolean;
  withDeps?: boolean;
  'with-deps'?: boolean;
  projects?: string[];
  select?: string;
  skipNxCache?: boolean;
  'skip-nx-cache'?: boolean;
  'hide-cached-output'?: boolean;
  hideCachedOutput?: boolean;
  scan?: boolean;
}

const ignoreArgs = ['$0', '_'];

export function splitArgsIntoNxArgsAndOverrides(
  args: yargs.Arguments,
  mode: 'run-one' | 'run-many' | 'affected' | 'print-affected',
  options = { printWarnings: true }
): { nxArgs: NxArgs; overrides: yargs.Arguments } {
  const nxSpecific =
    mode === 'run-one' ? runOne : mode === 'run-many' ? runMany : runAffected;

  const nxArgs: RawNxArgs = {};
  const overrides = yargsParser(args._ as string[], {
    configuration: {
      'strip-dashed': true,
    },
  });
  // This removes the overrides from the nxArgs._
  args._ = overrides._;

  delete overrides._;

  Object.entries(args).forEach(([key, value]) => {
    const dasherized = names(key).fileName;
    if (nxSpecific.includes(dasherized) || dasherized.startsWith('nx-')) {
      nxArgs[key] = value;
    } else if (!ignoreArgs.includes(key)) {
      overrides[key] = value;
    }
  });

  if (mode === 'run-many') {
    if (!nxArgs.projects) {
      nxArgs.projects = [];
    } else {
      nxArgs.projects = (args.projects as string)
        .split(',')
        .map((p: string) => p.trim());
    }
  }

  if (nxArgs.prod) {
    delete nxArgs.prod;
    nxArgs.configuration = 'production';
  }

  if (mode === 'affected') {
    if (options.printWarnings && nxArgs.all) {
      output.warn({
        title: `Running affected:* commands with --all can result in very slow builds.`,
        bodyLines: [
          `${output.bold(
            '--all'
          )} is not meant to be used for any sizable project or to be used in CI.`,
          '',
          `${output.colors.gray(
            'Learn more about checking only what is affected: '
          )}https://nx.dev/latest/angular/cli/affected#affected.`,
        ],
      });
    }

    if (
      !nxArgs.files &&
      !nxArgs.uncommitted &&
      !nxArgs.untracked &&
      !nxArgs.base &&
      !nxArgs.head &&
      !nxArgs.all &&
      args._.length >= 3
    ) {
      nxArgs.base = args._[1] as string;
      nxArgs.head = args._[2] as string;
    }

    // Allow setting base and head via environment variables (lower priority then direct command arguments)
    if (!nxArgs.base && process.env.NX_BASE) {
      nxArgs.base = process.env.NX_BASE;
      if (options.printWarnings) {
        output.note({
          title: `No explicit --base argument provided, but found environment variable NX_BASE so using its value as the affected base: ${output.bold(
            `${nxArgs.base}`
          )}`,
        });
      }
    }
    if (!nxArgs.head && process.env.NX_HEAD) {
      nxArgs.head = process.env.NX_HEAD;
      if (options.printWarnings) {
        output.note({
          title: `No explicit --head argument provided, but found environment variable NX_HEAD so using its value as the affected head: ${output.bold(
            `${nxArgs.head}`
          )}`,
        });
      }
    }

    if (!nxArgs.base) {
      const affectedConfig = getAffectedConfig();
      nxArgs.base = affectedConfig.defaultBase;

      // No user-provided arguments to set the affected criteria, so inform the user of the defaults being used
      if (
        options.printWarnings &&
        !nxArgs.head &&
        !nxArgs.files &&
        !nxArgs.uncommitted &&
        !nxArgs.untracked &&
        !nxArgs.all
      ) {
        output.note({
          title: `Affected criteria defaulted to --base=${output.bold(
            `${nxArgs.base}`
          )} --head=${output.bold('HEAD')}`,
        });
      }
    }
  }

  if (!nxArgs.skipNxCache) {
    nxArgs.skipNxCache = false;
  }

  if (args['parallel'] === 'false' || args['parallel'] === false) {
    nxArgs['parallel'] = 1;
  } else if (
    args['parallel'] === 'true' ||
    args['parallel'] === true ||
    args['parallel'] === ''
  ) {
    nxArgs['parallel'] = Number(
      nxArgs['maxParallel'] || nxArgs['max-parallel'] || 3
    );
  } else if (args['parallel'] !== undefined) {
    nxArgs['parallel'] = Number(args['parallel']);
  } else {
    nxArgs['parallel'] = undefined;
  }

  return { nxArgs, overrides };
}

export function getAffectedConfig(): NxAffectedConfig {
  const config = readNxJson();

  return {
    defaultBase: config.affected?.defaultBase || 'main',
  };
}
