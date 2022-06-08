import {
  combineOptionsForExecutor,
  handleErrors,
  Schema,
} from '../utils/params';
import { printHelp } from '../utils/print-help';
import { Workspaces } from '../config/workspaces';
import { NxJsonConfiguration } from '../config/nx-json';
import { readJsonFile } from '../utils/fileutils';
import { buildTargetFromScript, PackageJson } from '../utils/package-json';
import { join } from 'path';
import { existsSync } from 'fs';
import {
  loadNxPlugins,
  mergePluginTargetsWithNxTargets,
} from '../utils/nx-plugin';
import {
  ProjectConfiguration,
  TargetConfiguration,
  ProjectsConfigurations,
} from '../config/workspace-json-project-json';
import { Executor, ExecutorContext } from '../config/misc-interfaces';

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
  workspace: ProjectsConfigurations,
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
  workspace: ProjectsConfigurations & NxJsonConfiguration,
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
    throw new Error(`Cannot find target '${target}' for project '${project}'`);
  }

  configuration = configuration ?? targetConfig.defaultConfiguration;

  const [nodeModule, executor] = targetConfig.executor.split(':');
  const { schema, implementationFactory } = ws.readExecutor(
    nodeModule,
    executor
  );

  if (printHelp) {
    printRunHelp({ project, target }, schema, {
      plugin: nodeModule,
      entity: executor,
    });
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
    require('../adapter/compat');
    const observable = await (
      await import('../adapter/ngcli-adapter')
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
    const { eachValueFrom } = await import('../adapter/rxjs-for-await');
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
  targetDescription: {
    project: string;
    target: string;
    configuration?: string;
  },
  overrides: { [k: string]: any },
  isVerbose: boolean,
  isHelp: boolean
) {
  const ws = new Workspaces(root);
  return handleErrors(isVerbose, async () => {
    const workspace = ws.readWorkspaceConfiguration();
    return iteratorToProcessStatusCode(
      await runExecutorInternal(
        targetDescription,
        overrides,
        root,
        cwd,
        workspace,
        isVerbose,
        isHelp
      )
    );
  });
}
