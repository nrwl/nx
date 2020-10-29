import { WorkspaceNodeModulesArchitectHost } from '@angular-devkit/architect/node';
import { json, workspaces } from '@angular-devkit/core';
import { NodeJsSyncHost } from '@angular-devkit/core/node';
import { NxArgs } from '@nrwl/workspace/src/command-line/utils';
import { join } from 'path';
import * as yargs from 'yargs';
import { workspaceFileName } from '../core/file-utils';
import { Hasher } from '../core/hasher/hasher';
import { ProjectGraph, ProjectGraphNode } from '../core/project-graph';
import { Environment, NxJson } from '../core/shared-interfaces';
import { appRootPath } from '../utils/app-root';
import { isRelativePath } from '../utils/fileutils';
import { projectHasTargetAndConfiguration } from '../utils/project-graph-utils';
import { ReporterArgs } from './default-reporter';
import { AffectedEventType, Task, TasksRunner } from './tasks-runner';

type RunArgs = yargs.Arguments & ReporterArgs;

export async function runCommand<T extends RunArgs>(
  projectsToRun: ProjectGraphNode[],
  projectGraph: ProjectGraph,
  { nxJson, workspaceResults }: Environment,
  nxArgs: NxArgs,
  overrides: any,
  reporter: any,
  initiatingProject: string | null
) {
  reporter.beforeRun(
    projectsToRun.map((p) => p.name),
    nxArgs,
    overrides
  );

  const { tasksRunner, tasksOptions } = getRunner(nxArgs, nxJson, {
    ...nxArgs,
    ...overrides,
  });

  const tasks: Task[] = [];
  for (const project of projectsToRun) {
    tasks.push(
      await createTask({
        project,
        target: nxArgs.target,
        configuration: nxArgs.configuration,
        overrides: overrides,
      })
    );
  }

  const hasher = new Hasher(projectGraph, nxJson, tasksOptions);
  const res = await hasher.hashTasks(tasks);
  for (let i = 0; i < res.length; ++i) {
    tasks[i].hash = res[i].value;
    tasks[i].hashDetails = res[i].details;
  }
  const cached = [];
  tasksRunner(tasks, tasksOptions, {
    initiatingProject: initiatingProject,
    target: nxArgs.target,
    projectGraph,
    nxJson,
  }).subscribe({
    next: (event: any) => {
      switch (event.type) {
        case AffectedEventType.TaskComplete: {
          workspaceResults.setResult(event.task.target.project, event.success);
          break;
        }
        case AffectedEventType.TaskCacheRead: {
          workspaceResults.setResult(event.task.target.project, event.success);
          cached.push(event.task.target.project);
          break;
        }
      }
    },
    error: console.error,
    complete: () => {
      // fix for https://github.com/nrwl/nx/issues/1666
      if (process.stdin['unref']) (process.stdin as any).unref();

      workspaceResults.saveResults();
      reporter.printResults(
        nxArgs,
        workspaceResults.failedProjects,
        workspaceResults.startedWithFailedProjects,
        cached
      );

      if (workspaceResults.hasFailure) {
        process.exit(1);
      }
    },
  });
}

export interface TaskParams {
  project: ProjectGraphNode;
  target: string;
  configuration: string;
  overrides: Object;
}

export async function createTask({
  project,
  target,
  configuration,
  overrides,
}: TaskParams): Promise<Task> {
  const config = projectHasTargetAndConfiguration(
    project,
    target,
    configuration
  )
    ? configuration
    : undefined;
  const qualifiedTarget = {
    project: project.name,
    target,
    configuration: config,
  };

  const interpolated = interpolateOverrides(
    overrides,
    project.name,
    project.data
  );

  // TODO : could cache these?
  const builderSchema = await getBuilderSchema(
    project.data.architect[target].builder
  );

  // only remove unrecognised props if the builder doesn't support them
  if (!builderSchema.additionalProperties) {
    const builderProps = getBuilderProps(builderSchema);

    for (const override in interpolated) {
      if (!builderProps.has(override)) {
        delete interpolated[override];
      }
    }
  }

  return {
    id: getId(qualifiedTarget),
    target: qualifiedTarget,
    projectRoot: project.data.root,
    overrides: interpolated,
  };
}

/**
 * Returns a set containing all the builder schema
 * property names (including aliases)
 *
 * @param schema The flattened schema of a builder
 */
function getBuilderProps(schema: json.JsonObject): Set<string> {
  const props = new Set(Object.keys(schema.properties));

  //add the aliases
  const schemaProps = schema.properties as any;
  for (const prop in schemaProps) {
    if (schemaProps[prop].alias) props.add(schemaProps[prop].alias);
    if (schemaProps[prop].aliases)
      schemaProps[prop].aliases.forEach((x: string) => props.add(x));
  }

  return props;
}

/**
 * Looks up the schema of the given builder and flattens it
 *
 * @param builder A builder name in the form {collection}:{builder}
 */
async function getBuilderSchema(builder: string): Promise<json.JsonObject> {
  // create an architect host in order to resolve the builder
  const fsHost = new NodeJsSyncHost();
  const { workspace } = await workspaces.readWorkspace(
    workspaceFileName(),
    workspaces.createWorkspaceHost(fsHost),
    workspaces.WorkspaceFormat.JSON
  );
  const architectHost = new WorkspaceNodeModulesArchitectHost(
    workspace,
    appRootPath
  );
  const builderDesc = await architectHost.resolveBuilder(builder);

  // use the registry to flatten the builder schema
  const registry = new json.schema.CoreSchemaRegistry();
  const flattenedSchema = await registry
    .flatten(builderDesc.optionSchema as json.JsonObject)
    .toPromise();

  return flattenedSchema;
}

function getId({
  project,
  target,
  configuration,
}: {
  project: string;
  target: string;
  configuration?: string;
}): string {
  let id = project + ':' + target;
  if (configuration) {
    id += ':' + configuration;
  }
  return id;
}

export function getRunner(
  nxArgs: NxArgs,
  nxJson: NxJson,
  overrides: any
): {
  tasksRunner: TasksRunner;
  tasksOptions: unknown;
} {
  let runner = nxArgs.runner;
  if (!nxJson.tasksRunnerOptions) {
    const t = require('./default-tasks-runner');
    return {
      tasksRunner: t.defaultTasksRunner,
      tasksOptions: overrides,
    };
  }

  if (!runner && !nxJson.tasksRunnerOptions.default) {
    const t = require('./default-tasks-runner');
    return {
      tasksRunner: t.defaultTasksRunner,
      tasksOptions: overrides,
    };
  }

  runner = runner || 'default';

  if (nxJson.tasksRunnerOptions[runner]) {
    let modulePath: string = nxJson.tasksRunnerOptions[runner].runner;

    let tasksRunner;
    if (modulePath) {
      if (isRelativePath(modulePath)) {
        modulePath = join(appRootPath, modulePath);
      }

      tasksRunner = require(modulePath);
      // to support both babel and ts formats
      if (tasksRunner.default) {
        tasksRunner = tasksRunner.default;
      }
    } else {
      tasksRunner = require('./default-tasks-runner').defaultTasksRunner;
    }

    return {
      tasksRunner,
      tasksOptions: {
        ...nxJson.tasksRunnerOptions[runner].options,
        ...overrides,
        skipNxCache: nxArgs.skipNxCache,
      },
    };
  } else {
    throw new Error(`Could not find runner configuration for ${runner}`);
  }
}

function interpolateOverrides<T = any>(
  args: T,
  projectName: string,
  projectMetadata: any
): T {
  const interpolatedArgs: T = { ...args };
  Object.entries(interpolatedArgs).forEach(([name, value]) => {
    if (typeof value === 'string') {
      const regex = /{project\.([^}]+)}/g;
      interpolatedArgs[name] = value.replace(regex, (_, group: string) => {
        if (group.includes('.')) {
          throw new Error('Only top-level properties can be interpolated');
        }

        if (group === 'name') {
          return projectName;
        }
        return projectMetadata[group];
      });
    }
  });
  return interpolatedArgs;
}
