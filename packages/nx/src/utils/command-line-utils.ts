import * as yargsParser from 'yargs-parser';
import type { Arguments } from 'yargs';
import { TEN_MEGABYTES } from '../project-graph/file-utils';
import { output } from './output';
import { NxJsonConfiguration } from '../config/nx-json';
import { execSync } from 'child_process';
import { ProjectGraph } from '../config/project-graph';
import { workspaceRoot } from './workspace-root';

export interface RawNxArgs extends NxArgs {
  prod?: boolean;
}

export interface NxArgs {
  targets?: string[];
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
  verbose?: boolean;
  help?: boolean;
  version?: boolean;
  plain?: boolean;
  projects?: string[];
  select?: string;
  graph?: boolean;
  skipNxCache?: boolean;
  outputStyle?: string;
  nxBail?: boolean;
  nxIgnoreCycles?: boolean;
  type?: string;
}

export function splitArgsIntoNxArgsAndOverrides(
  args: { [k: string]: any },
  mode: 'run-one' | 'run-many' | 'affected' | 'print-affected',
  options = { printWarnings: true },
  nxJson: NxJsonConfiguration
): {
  nxArgs: NxArgs;
  overrides: Arguments & { __overrides_unparsed__: string[] };
} {
  // this is to lerna case when this function is invoked imperatively
  if (args['target'] && !args['targets']) {
    args['targets'] = [args['target']];
  }
  delete args['target'];
  delete args['t'];

  if (!args.__overrides_unparsed__ && args._) {
    // required for backwards compatibility
    args.__overrides_unparsed__ = args._;
    delete args._;
  }
  // This handles the way Lerna passes in overrides
  if (!args.__overrides_unparsed__ && args.__overrides__) {
    // required for backwards compatibility
    args.__overrides_unparsed__ = args.__overrides__;
    delete args._;
  }

  const nxArgs: RawNxArgs = args;
  let overrides = yargsParser(args.__overrides_unparsed__ as string[], {
    configuration: {
      'camel-case-expansion': false,
      'dot-notation': true,
    },
  });

  if (!overrides._ || overrides._.length === 0) {
    delete overrides._;
  }

  overrides.__overrides_unparsed__ = args.__overrides_unparsed__;
  delete (nxArgs as any).$0;
  delete (nxArgs as any).__overrides_unparsed__;

  if (mode === 'run-many') {
    const args = nxArgs as any;
    if (!args.projects) {
      args.projects = [];
    } else if (typeof args.projects === 'string') {
      args.projects = args.projects.split(',');
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
          `${output.dim(
            'Learn more about checking only what is affected: https://nx.dev/nx/affected'
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
      overrides._ &&
      overrides._.length >= 2
    ) {
      throw new Error(
        `Nx no longer supports using positional arguments for base and head. Please use --base and --head instead.`
      );
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
      nxArgs.base = nxJson.affected?.defaultBase || 'main';

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

    if (nxArgs.base) {
      nxArgs.base = getMergeBase(nxArgs.base, nxArgs.head);
    }
  }

  if (!nxArgs.skipNxCache) {
    nxArgs.skipNxCache = process.env.NX_SKIP_NX_CACHE === 'true';
  }

  if (!nxArgs.runner && process.env.NX_RUNNER) {
    nxArgs.runner = process.env.NX_RUNNER;
    if (options.printWarnings) {
      output.note({
        title: `No explicit --runner argument provided, but found environment variable NX_RUNNER so using its value: ${output.bold(
          `${nxArgs.runner}`
        )}`,
      });
    }
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
  return parseGitOutput(`git diff --name-only --no-renames --relative HEAD .`);
}

``;

function getUntrackedFiles(): string[] {
  return parseGitOutput(`git ls-files --others --exclude-standard`);
}

function getMergeBase(base: string, head: string = 'HEAD') {
  try {
    return execSync(`git merge-base "${base}" "${head}"`, {
      maxBuffer: TEN_MEGABYTES,
      cwd: workspaceRoot,
      stdio: 'pipe',
    })
      .toString()
      .trim();
  } catch {
    try {
      return execSync(`git merge-base --fork-point "${base}" "${head}"`, {
        maxBuffer: TEN_MEGABYTES,
        cwd: workspaceRoot,
        stdio: 'pipe',
      })
        .toString()
        .trim();
    } catch {
      return base;
    }
  }
}

function getFilesUsingBaseAndHead(base: string, head: string): string[] {
  return parseGitOutput(
    `git diff --name-only --no-renames --relative "${base}" "${head}"`
  );
}

function parseGitOutput(command: string): string[] {
  return execSync(command, { maxBuffer: TEN_MEGABYTES, cwd: workspaceRoot })
    .toString('utf-8')
    .split('\n')
    .map((a) => a.trim())
    .filter((a) => a.length > 0);
}

export function getProjectRoots(
  projectNames: string[],
  { nodes }: ProjectGraph
): string[] {
  return projectNames.map((name) => nodes[name].data.root);
}
