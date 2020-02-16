import * as yargsParser from 'yargs-parser';
import * as yargs from 'yargs';
import * as fileUtils from '../core/file-utils';

const runOne = [
  'target',
  'configuration',
  'prod',
  'runner',
  'parallel',
  'maxParallel',
  'max-parallel',
  'exclude',
  'onlyFailed',
  'only-failed',
  'verbose',
  'help',
  'version',
  'withDeps',
  'with-deps',
  'skipNxCache',
  'skip-nx-cache',
];

const runMany = [...runOne, 'projects', 'quiet', 'all'];

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
];

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
}

const ignoreArgs = ['$0', '_'];

export function splitArgsIntoNxArgsAndOverrides(
  args: yargs.Arguments,
  mode: 'run-one' | 'run-many' | 'affected'
): { nxArgs: NxArgs; overrides: yargs.Arguments } {
  const nxSpecific =
    mode === 'run-one' ? runOne : mode === 'run-many' ? runMany : runAffected;

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

  if (mode === 'run-many') {
    if (!nxArgs.projects) {
      nxArgs.projects = [];
    } else {
      nxArgs.projects = args.projects.split(',').map((p: string) => p.trim());
    }
  }

  if (nxArgs.prod) {
    delete nxArgs.prod;
    nxArgs.configuration = 'production';
  }

  if (mode === 'affected') {
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
      nxArgs.base = getDefaultBranch();
    }
  }

  if (!nxArgs.skipNxCache) {
    nxArgs.skipNxCache = false;
  }

  return { nxArgs, overrides };
}

export function getDefaultBranch(): string {
  const config = fileUtils.readNxJson();
  return config.defaultBranch ? config.defaultBranch : 'master';
}
