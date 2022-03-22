import * as yargsParser from 'yargs-parser';
import {
  combineOptionsForExecutor,
  convertToCamelCase,
  handleErrors,
  Options,
  Schema,
} from '../shared/params';
import { printHelp } from '../shared/print-help';
import {
  Executor,
  ExecutorContext,
  ProjectConfiguration,
  TargetConfiguration,
  WorkspaceJsonConfiguration,
  Workspaces,
} from '../shared/workspace';

import * as chalk from 'chalk';
import { logger } from '../shared/logger';
import { NxJsonConfiguration } from '../shared/nx';
import { splitTarget } from '../utils/split-target';
import { readJsonFile } from '../utils/fileutils';
import { buildTargetFromScript, PackageJson } from '../shared/package-json';
import { join } from 'path';
import { existsSync } from 'fs';
import {
  loadNxPlugins,
  mergePluginTargetsWithNxTargets,
} from '../shared/nx-plugin';

export interface Target {
  project: string;
  target: string;
  configuration?: string;
}

export interface RunOptions extends Target {
  help: boolean;
  runOptions: Options;
}

function throwInvalidInvocation() {
  throw new Error(
    `Specify the project name and the target (e.g., nx run proj:build)`
  );
}

function parseRunOpts(
  cwd: string,
  args: string[],
  defaultProjectName: string | null
): RunOptions {
  const runOptions = convertToCamelCase(
    yargsParser(args, {
      boolean: ['help', 'prod'],
      string: ['configuration', 'project'],
      alias: {
        c: 'configuration',
      },
      configuration: {
        'strip-dashed': false,
      },
    })
  );
  const help = runOptions.help as boolean;
  if (!runOptions._ || !runOptions._[0]) {
    throwInvalidInvocation();
  }
  // eslint-disable-next-line prefer-const
  let [project, target, configuration]: [string, string, string] = splitTarget(
    runOptions._[0]
  );

  if (!project && defaultProjectName) {
    logger.debug(
      `No project name specified. Using default project : ${chalk.bold(
        defaultProjectName
      )}`
    );
    project = defaultProjectName;
  }
  if (runOptions.configuration) {
    configuration = runOptions.configuration as string;
  }
  if (runOptions.prod) {
    configuration = 'production';
  }
  if (runOptions.project) {
    project = runOptions.project as string;
  }
  if (!project || !target) {
    throwInvalidInvocation();
  }
  const res = { project, target, configuration, help, runOptions };
  delete runOptions['help'];
  delete runOptions['_'];
  delete runOptions['c'];
  delete runOptions['configuration'];
  delete runOptions['prod'];
  delete runOptions['project'];

  return res;
}

export function printRunHelp(
  opts: { project: string; target: string },
  schema: Schema
) {
  printHelp(`nx run ${opts.project}:${opts.target}`, schema);
}

export function validateProject(
  workspace: WorkspaceJsonConfiguration,
  projectName: string
) {
  const project = workspace.projects[projectName];
  if (!project) {
    throw new Error(`Could not find project "${projectName}"`);
  }
}

function isPromise<T extends { success: boolean }>(
  v: Promise<T> | AsyncIterableIterator<T>
): v is Promise<T> {
  return typeof (v as any)?.then === 'function';
}

function isAsyncIterator<T extends { success: boolean }>(
  v: Promise<{ success: boolean }> | AsyncIterableIterator<T>
): v is AsyncIterableIterator<T> {
  return typeof (v as any)?.[Symbol.asyncIterator] === 'function';
}

async function* promiseToIterator<T extends { success: boolean }>(
  v: Promise<T>
): AsyncIterableIterator<T> {
  yield await v;
}

async function iteratorToProcessStatusCode(
  i: AsyncIterableIterator<{ success: boolean }>
): Promise<number> {
  let success: boolean;

  // This is a workaround to fix an issue that only happens with
  // the @angular-devkit/build-angular:browser builder. Starting
  // on version 12.0.1, a SASS compilation implementation was
  // introduced making use of workers and it's unref()-ing the worker
  // too early, causing the process to exit early in environments
  // like CI or when running Docker builds.
  const keepProcessAliveInterval = setInterval(() => {}, 1000);
  try {
    let prev: IteratorResult<{ success: boolean }>;
    let current: IteratorResult<{ success: boolean }>;
    do {
      prev = current;
      current = await i.next();
    } while (!current.done);

    success =
      current.value !== undefined || !prev
        ? current.value.success
        : prev.value.success;

    return success ? 0 : 1;
  } finally {
    clearInterval(keepProcessAliveInterval);
  }
}

function createImplicitTargetConfig(
  root: string,
  proj: ProjectConfiguration,
  targetName: string
): TargetConfiguration | null {
  const packageJsonPath = join(root, proj.root, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return null;
  }
  const { scripts, nx } = readJsonFile<PackageJson>(packageJsonPath);
  if (!(targetName in (scripts || {}))) {
    return null;
  }
  return buildTargetFromScript(targetName, nx);
}

async function runExecutorInternal<T extends { success: boolean }>(
  {
    project,
    target,
    configuration,
  }: {
    project: string;
    target: string;
    configuration?: string;
  },
  options: { [k: string]: any },
  root: string,
  cwd: string,
  workspace: WorkspaceJsonConfiguration & NxJsonConfiguration,
  isVerbose: boolean,
  printHelp: boolean
): Promise<AsyncIterableIterator<T>> {
  validateProject(workspace, project);

  const ws = new Workspaces(root);
  const proj = workspace.projects[project];
  const targetConfig =
    proj.targets?.[target] ||
    createImplicitTargetConfig(root, proj, target) ||
    mergePluginTargetsWithNxTargets(
      proj.root,
      proj.targets,
      loadNxPlugins(workspace.plugins)
    )[target];

  if (!targetConfig) {
    throw new Error(
      `NX Cannot find target '${target}' for project '${project}'`
    );
  }

  configuration = configuration ?? targetConfig.defaultConfiguration;

  const [nodeModule, executor] = targetConfig.executor.split(':');
  const { schema, implementationFactory } = ws.readExecutor(
    nodeModule,
    executor
  );

  if (printHelp) {
    printRunHelp({ project, target }, schema);
    process.exit(0);
  }

  const combinedOptions = combineOptionsForExecutor(
    options,
    configuration,
    targetConfig,
    schema,
    project,
    ws.relativeCwd(cwd),
    isVerbose
  );

  if (ws.isNxExecutor(nodeModule, executor)) {
    const implementation = implementationFactory() as Executor<any>;
    const r = implementation(combinedOptions, {
      root,
      target: targetConfig,
      workspace,
      projectName: project,
      targetName: target,
      configurationName: configuration,
      cwd,
      isVerbose,
    }) as Promise<T> | AsyncIterableIterator<T>;
    if (isPromise<T>(r)) {
      return promiseToIterator<T>(r);
    } else if (isAsyncIterator<T>(r)) {
      return r;
    } else {
      throw new TypeError(
        `NX Executor "${targetConfig.executor}" should return either a Promise or an AsyncIterator`
      );
    }
  } else {
    require('../compat/compat');
    const observable = await (
      await import('./ngcli-adapter')
    ).scheduleTarget(
      root,
      {
        project,
        target,
        configuration,
        runOptions: combinedOptions,
        executor: targetConfig.executor,
      },
      isVerbose
    );
    const { eachValueFrom } = require('rxjs-for-await');
    return eachValueFrom(observable as any);
  }
}

/**
 * Loads and invokes executor.
 *
 * This is analogous to invoking executor from the terminal, with the exception
 * that the params aren't parsed from the string, but instead provided parsed already.
 *
 * Apart from that, it works the same way:
 *
 * - it will load the workspace configuration
 * - it will resolve the target
 * - it will load the executor and the schema
 * - it will load the options for the appropriate configuration
 * - it will run the validations and will set the default
 * - and, of course, it will invoke the executor
 *
 * Example:
 *
 * ```typescript
 * for await (const s of await runExecutor({project: 'myproj', target: 'serve'}, {watch: true}, context)) {
 *   // s.success
 * }
 * ```
 *
 * Note that the return value is a promise of an iterator, so you need to await before iterating over it.
 */
export async function runExecutor<T extends { success: boolean }>(
  targetDescription: {
    project: string;
    target: string;
    configuration?: string;
  },
  options: { [k: string]: any },
  context: ExecutorContext
): Promise<AsyncIterableIterator<T>> {
  return await runExecutorInternal<T>(
    targetDescription,
    options,
    context.root,
    context.cwd,
    context.workspace,
    context.isVerbose,
    false
  );
}

export async function run(
  cwd: string,
  root: string,
  args: string[],
  isVerbose: boolean
) {
  const ws = new Workspaces(root);

  return handleErrors(isVerbose, async () => {
    const workspace = ws.readWorkspaceConfiguration();
    const defaultProjectName = ws.calculateDefaultProjectName(cwd, workspace);
    const opts = parseRunOpts(cwd, args, defaultProjectName);
    return iteratorToProcessStatusCode(
      await runExecutorInternal(
        opts,
        opts.runOptions,
        root,
        cwd,
        workspace,
        isVerbose,
        opts.help
      )
    );
  });
}
