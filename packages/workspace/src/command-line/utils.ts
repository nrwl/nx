import * as yargsParser from 'yargs-parser';
import * as yargs from 'yargs';
import * as fileUtils from '../core/file-utils';
import { NxAffectedConfig } from '../core/shared-interfaces';
import { output } from '../utils/output';

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
  'scan',
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
      nxArgs.base = args._[0];
      nxArgs.head = args._[1];
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
        ) + 'https://nx.dev/guides/monorepo-affected.',
      ],
    });
  }
}
