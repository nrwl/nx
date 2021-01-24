import * as yargsParser from 'yargs-parser';
import * as yargs from 'yargs';
import * as fileUtils from '../core/file-utils';
import { NxAffectedConfig } from '../core/shared-interfaces';
import { output } from '../utilities/output';
import { names } from '@nrwl/devkit';

const runOne = [
  'target',
  'configuration',
  'prod',
  'runner',
  'parallel',
  'max-parallel',
  'exclude',
  'only-failed',
  'help',
  'version',
  'with-deps',
  'skip-nx-cache',
  'scan',
];

const runMany = [...runOne, 'projects', 'quiet', 'all', 'verbose'];

const runAffected = [
  ...runOne,
  'untracked',
  'uncommitted',
  'all',
  'base',
  'head',
  'files',
  'quiet',
  'plain',
  'select',
  'verbose',
];

export interface RawNxArgs extends NxArgs {
  prod?: boolean;
}

export interface NxArgs {
  target?: string;
  configuration?: string;
  runner?: string;
  parallel?: boolean;
  maxParallel?: number;
  'max-parallel'?: number;
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
  quiet?: boolean;
  plain?: boolean;
  withDeps?: boolean;
  'with-deps'?: boolean;
  projects?: string[];
  select?: string;
  skipNxCache?: boolean;
  'skip-nx-cache'?: boolean;
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
  const overrides = yargsParser(args._ as string[]);
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
    if (options.printWarnings) {
      printArgsWarning(nxArgs);
    }
    if (
      !nxArgs.files &&
      !nxArgs.uncommitted &&
      !nxArgs.untracked &&
      !nxArgs.base &&
      !nxArgs.head &&
      !nxArgs.all &&
      args._.length >= 2
    ) {
      nxArgs.base = args._[0] as string;
      nxArgs.head = args._[1] as string;
    } else if (!nxArgs.base) {
      const affectedConfig = getAffectedConfig();

      nxArgs.base = affectedConfig.defaultBase;
    }
  }

  if (!nxArgs.skipNxCache) {
    nxArgs.skipNxCache = false;
  }

  return { nxArgs, overrides };
}

export function getAffectedConfig(): NxAffectedConfig {
  const config = fileUtils.readNxJson();
  const defaultBase = 'master';

  if (config.affected) {
    return {
      defaultBase: config.affected.defaultBase || defaultBase,
    };
  } else {
    return {
      defaultBase,
    };
  }
}

function printArgsWarning(options: NxArgs) {
  const { files, uncommitted, untracked, base, head, all } = options;
  const affectedConfig = getAffectedConfig();

  if (!files && !uncommitted && !untracked && !base && !head && !all) {
    output.note({
      title: `Affected criteria defaulted to --base=${output.bold(
        `${affectedConfig.defaultBase}`
      )} --head=${output.bold('HEAD')}`,
    });
  }

  if (all) {
    output.warn({
      title: `Running affected:* commands with --all can result in very slow builds.`,
      bodyLines: [
        output.bold('--all') +
          ' is not meant to be used for any sizable project or to be used in CI.',
        '',
        output.colors.gray(
          'Learn more about checking only what is affected: '
        ) + 'https://nx.dev/latest/angular/cli/affected#affected.',
      ],
    });
  }
}
