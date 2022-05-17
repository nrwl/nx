import * as yargsParser from 'yargs-parser';
import * as yargs from 'yargs';
import {
  readNxJson,
  readWorkspaceJson,
  TEN_MEGABYTES,
} from '../project-graph/file-utils';
import { output } from './output';
import { NxAffectedConfig } from '../config/nx-json';
import { execSync } from 'child_process';

export function names(name: string): {
  name: string;
  className: string;
  propertyName: string;
  constantName: string;
  fileName: string;
} {
  return {
    name,
    className: toClassName(name),
    propertyName: toPropertyName(name),
    constantName: toConstantName(name),
    fileName: toFileName(name),
  };
}

/**
 * Hyphenated to UpperCamelCase
 */
function toClassName(str: string): string {
  return toCapitalCase(toPropertyName(str));
}

/**
 * Hyphenated to lowerCamelCase
 */
function toPropertyName(s: string): string {
  return s
    .replace(/([^a-zA-Z0-9])+(.)?/g, (_, __, chr) =>
      chr ? chr.toUpperCase() : ''
    )
    .replace(/[^a-zA-Z\d]/g, '')
    .replace(/^([A-Z])/, (m) => m.toLowerCase());
}

/**
 * Hyphenated to CONSTANT_CASE
 */
function toConstantName(s: string): string {
  return s.replace(/([^a-zA-Z0-9])/g, '_').toUpperCase();
}

/**
 * Upper camelCase to lowercase, hyphenated
 */
function toFileName(s: string): string {
  return s
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[ _]/g, '-');
}

/**
 * Capitalizes the first letter of a string
 */
function toCapitalCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const runOne: string[] = [
  'target',
  'configuration',
  'prod',
  'runner',
  'parallel',
  'maxParallel',
  'exclude',
  'onlyFailed',
  'help',
  'withDeps',
  'skipNxCache',
  'scan',
  'outputStyle',
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
  'output-style'?: string;
  outputStyle?: string;
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
      'camel-case-expansion': false,
      'dot-notation': false,
    },
  });
  // This removes the overrides from the nxArgs._
  args._ = overrides._;

  delete overrides._;

  Object.entries(args).forEach(([key, value]) => {
    const camelCased = names(key).propertyName;
    if (nxSpecific.includes(camelCased) || camelCased.startsWith('nx')) {
      if (value !== undefined) nxArgs[camelCased] = value;
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

  // TODO(v15): onlyFailed should not be an option
  if (options.printWarnings && nxArgs.onlyFailed) {
    output.warn({
      title: `--onlyFailed is deprecated. All tasks will be run.`,
    });
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
          `${output.dim(
            'Learn more about checking only what is affected: https://nx.dev/cli/affected'
          )}`,
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
    nxArgs.skipNxCache = process.env.NX_SKIP_NX_CACHE === 'true';
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
  }

  return { nxArgs, overrides } as any;
}

export function getAffectedConfig(): NxAffectedConfig {
  const config = readNxJson();

  return {
    defaultBase: config.affected?.defaultBase || 'main',
  };
}

export function parseFiles(options: NxArgs): { files: string[] } {
  const { files, uncommitted, untracked, base, head } = options;

  if (files) {
    return {
      files,
    };
  } else if (uncommitted) {
    return {
      files: getUncommittedFiles(),
    };
  } else if (untracked) {
    return {
      files: getUntrackedFiles(),
    };
  } else if (base && head) {
    return {
      files: getFilesUsingBaseAndHead(base, head),
    };
  } else if (base) {
    return {
      files: Array.from(
        new Set([
          ...getFilesUsingBaseAndHead(base, 'HEAD'),
          ...getUncommittedFiles(),
          ...getUntrackedFiles(),
        ])
      ),
    };
  }
}

function getUncommittedFiles(): string[] {
  return parseGitOutput(`git diff --name-only --relative HEAD .`);
}

function getUntrackedFiles(): string[] {
  return parseGitOutput(`git ls-files --others --exclude-standard`);
}

function getFilesUsingBaseAndHead(base: string, head: string): string[] {
  let mergeBase: string;
  try {
    mergeBase = execSync(`git merge-base "${base}" "${head}"`, {
      maxBuffer: TEN_MEGABYTES,
    })
      .toString()
      .trim();
  } catch {
    mergeBase = execSync(`git merge-base --fork-point "${base}" "${head}"`, {
      maxBuffer: TEN_MEGABYTES,
    })
      .toString()
      .trim();
  }
  return parseGitOutput(
    `git diff --name-only --relative "${mergeBase}" "${head}"`
  );
}

function parseGitOutput(command: string): string[] {
  return execSync(command, { maxBuffer: TEN_MEGABYTES })
    .toString('utf-8')
    .split('\n')
    .map((a) => a.trim())
    .filter((a) => a.length > 0);
}

export function getProjectRoots(projectNames: string[]): string[] {
  const { projects } = readWorkspaceJson();
  return projectNames.map((name) => projects[name].root);
}
