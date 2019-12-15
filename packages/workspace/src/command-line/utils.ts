import * as yargsParser from 'yargs-parser';
import * as yargs from 'yargs';
import { WorkspaceResults } from './workspace-results';
import { ProjectGraphNode } from '../core/project-graph';
import { readWorkspaceJson, readNxJson } from '../core/file-utils';
import { NxJson } from '../core/shared-interfaces';

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
  projects: []
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
  _: string[];
}

const ignoreArgs = ['$0', '_'];

export function splitArgsIntoNxArgsAndTargetArgs(
  args: yargs.Arguments
): { nxArgs: NxArgs; targetArgs: yargs.Arguments } {
  const nxArgs: any = {};
  const targetArgs = yargsParser(args._);
  delete targetArgs._;

  Object.entries(args).forEach(([key, value]) => {
    if (nxSpecific.includes(key as any)) {
      nxArgs[key] = value;
    } else if (!ignoreArgs.includes(key)) {
      targetArgs[key] = value;
    }
  });

  if (!nxArgs.projects) {
    nxArgs.projects = [];
  } else {
    nxArgs.projects = args.projects.split(',').map((p: string) => p.trim());
  }

  return { nxArgs, targetArgs };
}
