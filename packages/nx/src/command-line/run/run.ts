import {
  combineOptionsForExecutor,
  handleErrors,
  Schema,
} from '../../utils/params';
import { printHelp } from '../../utils/print-help';
import { Workspaces } from '../../config/workspaces';
import { NxJsonConfiguration } from '../../config/nx-json';
import { readJsonFile } from '../../utils/fileutils';
import { buildTargetFromScript, PackageJson } from '../../utils/package-json';
import { join } from 'path';
import { existsSync } from 'fs';
import {
  loadNxPlugins,
  mergePluginTargetsWithNxTargets,
} from '../../utils/nx-plugin';
import {
  ProjectConfiguration,
  TargetConfiguration,
  ProjectsConfigurations,
} from '../../config/workspace-json-project-json';
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
  // This is a workaround to fix an issue that only happens with
  // the @angular-devkit/build-angular:browser builder. Starting
  // on version 12.0.1, a SASS compilation implementation was
  // introduced making use of workers and it's unref()-ing the worker
  // too early, causing the process to exit early in environments
  // like CI or when running Docker builds.
  const keepProcessAliveInterval = setInterval(() => {}, 1000);
  try {
    const { success } = await getLastValueFromAsyncIterableIterator(i);
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
  if (
    !(targetName in (scripts || {})) ||
    !(nx.includedScripts && nx.includedScripts.includes(targetName))
  ) {
    return null;
  }
  return buildTargetFromScript(targetName, nx);
}

async function parseExecutorAndTarget(
  ws: Workspaces,
  { project, target, configuration }: Target,
  root: string,
  projectsConfigurations: ProjectsConfigurations,
  nxJsonConfiguration: NxJsonConfiguration
) {
  const proj = projectsConfigurations.projects[project];
  const targetConfig =
    proj.targets?.[target] ||
    createImplicitTargetConfig(root, proj, target) ||
    mergePluginTargetsWithNxTargets(
      proj.root,
      proj.targets,
      await loadNxPlugins(nxJsonConfiguration.plugins, [root], root)
    )[target];

  if (!targetConfig) {
    throw new Error(`Cannot find target '${target}' for project '${project}'`);
  }

  const [nodeModule, executor] = targetConfig.executor.split(':');
  const { schema, implementationFactory } = ws.readExecutor(
    nodeModule,
    executor
  );

  return { executor, implementationFactory, nodeModule, schema, targetConfig };
}

async function printTargetRunHelpInternal(
  { project, target, configuration }: Target,
  root: string,
  projectsConfigurations: ProjectsConfigurations,
  nxJsonConfiguration: NxJsonConfiguration
) {
  const ws = new Workspaces(root);
  const { executor, nodeModule, schema } = await parseExecutorAndTarget(
    ws,
    { project, target, configuration },
    root,
    projectsConfigurations,
    nxJsonConfiguration
  );

  printRunHelp({ project, target }, schema, {
    plugin: nodeModule,
    entity: executor,
  });
  process.exit(0);
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

  const ws = new Workspaces(root);
  const { executor, implementationFactory, nodeModule, schema, targetConfig } =
    await parseExecutorAndTarget(
      ws,
      { project, target, configuration },
      root,
      projectsConfigurations,
      nxJsonConfiguration
    );
  configuration ??= targetConfig.defaultConfiguration;

  const combinedOptions = combineOptionsForExecutor(
    overrides,
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
      projectsConfigurations,
      nxJsonConfiguration,
      workspace: { ...projectsConfigurations, ...nxJsonConfiguration },
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
    const nxJsonConfiguration = readNxJson();

    printTargetRunHelpInternal(
      targetDescription,
      root,
      projectsConfigurations,
      nxJsonConfiguration
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
