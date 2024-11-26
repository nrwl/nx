import { env as appendLocalEnv } from 'npm-run-path';
import { combineOptionsForExecutor, Schema } from '../../utils/params';
import { handleErrors } from '../../utils/handle-errors';
import { printHelp } from '../../utils/print-help';
import { NxJsonConfiguration } from '../../config/nx-json';
import { relative } from 'path';
import { ProjectsConfigurations } from '../../config/workspace-json-project-json';
import { Executor, ExecutorContext } from '../../config/misc-interfaces';
import { TaskGraph } from '../../config/task-graph';
import { serializeOverridesIntoCommandLine } from '../../utils/serialize-overrides-into-command-line';
import {
  readCachedProjectGraph,
  readProjectsConfigurationFromProjectGraph,
} from '../../project-graph/project-graph';
import { ProjectGraph } from '../../config/project-graph';
import { readNxJson } from '../../config/configuration';
import {
  getLastValueFromAsyncIterableIterator,
  isAsyncIterator,
} from '../../utils/async-iterator';
import { getExecutorInformation } from './executor-utils';
import {
  getPseudoTerminal,
  PseudoTerminal,
} from '../../tasks-runner/pseudo-terminal';
import { exec } from 'child_process';

export interface Target {
  project: string;
  target: string;
  configuration?: string;
}

export function printRunHelp(
  opts: { project: string; target: string },
  schema: Schema,
  plugin: { plugin: string; entity: string }
) {
  printHelp(`run ${opts.project}:${opts.target}`, schema, {
    mode: 'run',
    ...plugin,
  });
}

export function validateProject(
  projects: ProjectsConfigurations,
  projectName: string
) {
  const project = projects.projects[projectName];
  if (!project) {
    throw new Error(`Could not find project "${projectName}"`);
  }
}

function isPromise<T extends { success: boolean }>(
  v: Promise<T> | AsyncIterableIterator<T>
): v is Promise<T> {
  return typeof (v as any)?.then === 'function';
}

async function* promiseToIterator<T extends { success: boolean }>(
  v: Promise<T>
): AsyncIterableIterator<T> {
  yield await v;
}

async function iteratorToProcessStatusCode(
  i: AsyncIterableIterator<{ success: boolean }>
): Promise<number> {
  const { success } = await getLastValueFromAsyncIterableIterator(i);
  return success ? 0 : 1;
}

async function parseExecutorAndTarget(
  { project, target }: Target,
  root: string,
  projectsConfigurations: ProjectsConfigurations
) {
  const proj = projectsConfigurations.projects[project];
  const targetConfig = proj.targets?.[target];

  if (!targetConfig) {
    throw new Error(`Cannot find target '${target}' for project '${project}'`);
  }

  const [nodeModule, executor] = targetConfig.executor.split(':');
  const { schema, implementationFactory } = getExecutorInformation(
    nodeModule,
    executor,
    root,
    projectsConfigurations.projects
  );

  return { executor, implementationFactory, nodeModule, schema, targetConfig };
}

async function printTargetRunHelpInternal(
  { project, target }: Target,
  root: string,
  projectsConfigurations: ProjectsConfigurations
) {
  const { executor, nodeModule, schema, targetConfig } =
    await parseExecutorAndTarget(
      { project, target },
      root,
      projectsConfigurations
    );

  printRunHelp({ project, target }, schema, {
    plugin: nodeModule,
    entity: executor,
  });

  if (
    nodeModule === 'nx' &&
    executor === 'run-commands' &&
    targetConfig.options.command
  ) {
    const command = targetConfig.options.command.split(' ')[0];
    const helpCommand = `${command} --help`;
    const localEnv = appendLocalEnv();
    const env = {
      ...process.env,
      ...localEnv,
    };
    if (PseudoTerminal.isSupported()) {
      const terminal = getPseudoTerminal();
      await new Promise(() => {
        const cp = terminal.runCommand(helpCommand, { jsEnv: env });
        cp.onExit((code) => {
          process.exit(code);
        });
      });
    } else {
      const cp = exec(helpCommand, {
        env,
        windowsHide: true,
      });
      cp.on('exit', (code) => {
        process.exit(code);
      });
    }
  } else {
    process.exit(0);
  }
}

async function runExecutorInternal<T extends { success: boolean }>(
  { project, target, configuration }: Target,
  overrides: { [k: string]: any },
  root: string,
  cwd: string,
  projectsConfigurations: ProjectsConfigurations,
  nxJsonConfiguration: NxJsonConfiguration,
  projectGraph: ProjectGraph,
  taskGraph: TaskGraph,
  isVerbose: boolean
): Promise<AsyncIterableIterator<T>> {
  validateProject(projectsConfigurations, project);

  const { executor, implementationFactory, nodeModule, schema, targetConfig } =
    await parseExecutorAndTarget(
      { project, target, configuration },
      root,
      projectsConfigurations
    );
  configuration ??= targetConfig.defaultConfiguration;

  const combinedOptions = combineOptionsForExecutor(
    overrides,
    configuration,
    targetConfig,
    schema,
    project,
    relative(root, cwd),
    isVerbose
  );

  if (
    getExecutorInformation(
      nodeModule,
      executor,
      root,
      projectsConfigurations.projects
    ).isNxExecutor
  ) {
    const implementation = implementationFactory() as Executor<any>;
    const r = implementation(combinedOptions, {
      root,
      target: targetConfig,
      projectsConfigurations,
      nxJsonConfiguration,
      projectName: project,
      targetName: target,
      configurationName: configuration,
      projectGraph,
      taskGraph,
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
    require('../../adapter/compat');
    const observable = await (
      await import('../../adapter/ngcli-adapter')
    ).scheduleTarget(
      root,
      {
        project,
        target,
        configuration,
        runOptions: combinedOptions,
        projects: projectsConfigurations.projects,
      },
      isVerbose
    );
    const { eachValueFrom } = await import('../../adapter/rxjs-for-await');
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
  targetDescription: Target,
  overrides: { [k: string]: any },
  context: ExecutorContext
): Promise<AsyncIterableIterator<T>> {
  return await runExecutorInternal<T>(
    targetDescription,
    {
      ...overrides,
      __overrides_unparsed__: serializeOverridesIntoCommandLine(overrides),
    },
    context.root,
    context.cwd,
    context.projectsConfigurations,
    context.nxJsonConfiguration,
    context.projectGraph,
    context.taskGraph,
    context.isVerbose
  );
}

export function printTargetRunHelp(targetDescription: Target, root: string) {
  const projectGraph = readCachedProjectGraph();
  return handleErrors(false, async () => {
    const projectsConfigurations =
      readProjectsConfigurationFromProjectGraph(projectGraph);

    await printTargetRunHelpInternal(
      targetDescription,
      root,
      projectsConfigurations
    );
  });
}

export function run(
  cwd: string,
  root: string,
  targetDescription: Target,
  overrides: { [k: string]: any },
  isVerbose: boolean,
  taskGraph: TaskGraph
) {
  const projectGraph = readCachedProjectGraph();
  return handleErrors(isVerbose, async () => {
    const projectsConfigurations =
      readProjectsConfigurationFromProjectGraph(projectGraph);
    return iteratorToProcessStatusCode(
      await runExecutorInternal(
        targetDescription,
        overrides,
        root,
        cwd,
        projectsConfigurations,
        readNxJson(),
        projectGraph,
        taskGraph,
        isVerbose
      )
    );
  });
}
