import * as yargsParser from 'yargs-parser';
import * as yargs from 'yargs';

/**
 * These options are only for getting an array with properties of AffectedOptions.
 *
 * @remark They are not defaults or useful for anything else
 */
const dummyOptions: NxArgs = {
  target: '',
  configuration: '',
  runner: '',
  parallel: false,
  maxParallel: 0,
  'max-parallel': 0,
  untracked: false,
  uncommitted: false,
  all: false,
  base: 'base',
  head: 'head',
  exclude: ['exclude'],
  files: [''],
  onlyFailed: false,
  'only-failed': false,
  verbose: false,
  help: false,
  version: false,
  quiet: false,
  plain: false,
  withDeps: false,
  'with-deps': false,
  projects: [],
  select: ''
} as any;

const nxSpecific = Object.keys(dummyOptions);

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
}

const ignoreArgs = ['$0', '_'];

export function splitArgsIntoNxArgsAndOverrides(
  args: yargs.Arguments
): { nxArgs: NxArgs; overrides: yargs.Arguments } {
  const nxArgs: any = {};
  const overrides = yargsParser(args._);
  delete overrides._;

  Object.entries(args).forEach(([key, value]) => {
    if (nxSpecific.includes(key as any)) {
      nxArgs[key] = value;
    } else if (!ignoreArgs.includes(key)) {
      overrides[key] = value;
    }
  });

  if (!nxArgs.projects) {
    nxArgs.projects = [];
  } else {
    nxArgs.projects = args.projects.split(',').map((p: string) => p.trim());
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
    nxArgs.base = args._[0];
    nxArgs.head = args._[1];
  } else if (!nxArgs.base) {
    nxArgs.base = 'master';
  }

  return { nxArgs, overrides };
}
