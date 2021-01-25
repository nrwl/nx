import * as minimist from 'minimist';
import {
  combineOptionsForExecutor,
  convertToCamelCase,
  handleErrors,
  Options,
  Schema,
} from '../shared/params';
import { printHelp } from '../shared/print-help';
import {
  ExecutorContext,
  WorkspaceConfiguration,
  Workspaces,
} from '../shared/workspace';

import * as chalk from 'chalk';
import { logger } from '../shared/logger';
import { eachValueFrom } from 'rxjs-for-await';

export interface RunOptions {
  project: string;
  target: string;
  configuration: string;
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
    minimist(args, {
      boolean: ['help', 'prod'],
      string: ['configuration', 'project'],
      alias: {
        c: 'configuration',
      },
    })
  );
  const help = runOptions.help as boolean;
  if (!runOptions._ || !runOptions._[0]) {
    throwInvalidInvocation();
  }
  // eslint-disable-next-line prefer-const
  let [project, target, configuration]: [
    string,
    string,
    string
  ] = runOptions._[0].split(':');
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

export function validateTargetAndConfiguration(
  workspace: WorkspaceConfiguration,
  opts: { project: string; target: string; configuration?: string }
) {
  const project = workspace.projects[opts.project];
  if (!project) {
    throw new Error(`Could not find project "${opts.project}"`);
  }
  const target = project.targets[opts.target];
  const availableTargets = Object.keys(project.targets);
  if (!target) {
    throw new Error(
      `Could not find target "${opts.target}" in the ${
        opts.project
      } project. Valid targets are: ${chalk.bold(availableTargets.join(', '))}`
    );
  }

  // Not all targets have configurations
  // and an undefined configuration is valid
  if (opts.configuration) {
    if (target.configurations) {
      const configuration = target.configurations[opts.configuration];
      if (!configuration) {
        throw new Error(
          `Could not find configuration "${opts.configuration}" in ${
            opts.project
          }:${opts.target}. Valid configurations are: ${Object.keys(
            target.configurations
          ).join(', ')}`
        );
      }
    } else {
      throw new Error(
        `No configurations are defined for ${opts.project}:${opts.target}, so "${opts.configuration}" is invalid.`
      );
    }
  }
}

function isPromise(
  v: Promise<{ success: boolean }> | AsyncIterableIterator<{ success: boolean }>
): v is Promise<{ success: boolean }> {
  return typeof (v as any).then === 'function';
}

async function* promiseToIterator(
  v: Promise<{ success: boolean }>
): AsyncIterableIterator<{ success: boolean }> {
  yield await v;
}

async function iteratorToProcessStatusCode(
  i: AsyncIterableIterator<{ success: boolean }>
): Promise<number> {
  let r;
  for await (r of i) {
  }
  if (!r) {
    throw new Error('NX Executor has not returned or yielded a response.');
  }
  return r.success ? 0 : 1;
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
  workspace: WorkspaceConfiguration,
  isVerbose: boolean,
  printHelp: boolean
): Promise<AsyncIterableIterator<T>> {
  validateTargetAndConfiguration(workspace, {
    project,
    target,
    configuration,
  });

  const ws = new Workspaces(root);
  const targetConfig = workspace.projects[project].targets[target];
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
    ws.relativeCwd(cwd)
  );

  if (ws.isNxExecutor(nodeModule, executor)) {
    const implementation = implementationFactory();
    const r = implementation(combinedOptions, {
      root: root,
      target: targetConfig,
      workspace: workspace,
      projectName: project,
      cwd: cwd,
      isVerbose: isVerbose,
    });
    return (isPromise(r) ? promiseToIterator(r) : r) as any;
  } else {
    const observable = await (await import('./ngcli-adapter')).scheduleTarget(
      root,
      {
        project,
        target,
        configuration,
        runOptions: combinedOptions,
      },
      isVerbose
    );
    return eachValueFrom<T>(observable as any);
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
