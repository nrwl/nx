import { performance } from 'perf_hooks';
import { parseGeneratorString } from '../command-line/generate/generate';
import { getGeneratorInformation } from '../command-line/generate/generator-utils';
import type { GeneratorCallback } from '../config/misc-interfaces';
import { readNxJson, type NxJsonConfiguration } from '../config/nx-json';
import type { ProjectGraph } from '../config/project-graph';
import type { TaskGraph } from '../config/task-graph';
import type { ProjectConfiguration } from '../config/workspace-json-project-json';
import { daemonClient } from '../daemon/client/client';
import { isOnDaemon } from '../daemon/is-on-daemon';
import {
  flushChanges,
  FsTree,
  type FileChange,
  type Tree,
} from '../generators/tree';
import {
  createProjectGraphAsync,
  readProjectsConfigurationFromProjectGraph,
} from '../project-graph/project-graph';
import { updateContextWithChangedFiles } from './workspace-context';
import { workspaceRoot } from './workspace-root';
import chalk = require('chalk');

export type SyncGeneratorResult = void | {
  callback?: GeneratorCallback;
  outOfSyncMessage?: string;
};

export type SyncGenerator = (
  tree: Tree
) => SyncGeneratorResult | Promise<SyncGeneratorResult>;

export type SyncGeneratorChangesResult = {
  changes: FileChange[];
  generatorName: string;
  callback?: GeneratorCallback;
  outOfSyncMessage?: string;
};

export async function getSyncGeneratorChanges(
  generators: string[]
): Promise<SyncGeneratorChangesResult[]> {
  performance.mark('get-sync-generators-changes:start');
  let results: SyncGeneratorChangesResult[];

  if (!daemonClient.enabled()) {
    results = await runSyncGenerators(generators);
  } else {
    results = await daemonClient.getSyncGeneratorChanges(generators);
  }

  performance.mark('get-sync-generators-changes:end');
  performance.measure(
    'get-sync-generators-changes',
    'get-sync-generators-changes:start',
    'get-sync-generators-changes:end'
  );

  return results.filter((r) => r.changes.length > 0);
}

export async function flushSyncGeneratorChanges(
  results: SyncGeneratorChangesResult[]
): Promise<void> {
  if (isOnDaemon() || !daemonClient.enabled()) {
    await flushSyncGeneratorChangesToDisk(results);
  } else {
    await daemonClient.flushSyncGeneratorChangesToDisk(
      results.map((r) => r.generatorName)
    );
  }
}

export async function collectAllRegisteredSyncGenerators(
  projectGraph: ProjectGraph,
  nxJson: NxJsonConfiguration
): Promise<string[]> {
  if (!daemonClient.enabled()) {
    return [
      ...collectEnabledTaskSyncGeneratorsFromProjectGraph(projectGraph, nxJson),
      ...collectRegisteredGlobalSyncGenerators(),
    ];
  }

  return await daemonClient.getRegisteredSyncGenerators();
}

export async function runSyncGenerator(
  tree: Tree,
  generatorSpecifier: string,
  projects: Record<string, ProjectConfiguration>
): Promise<SyncGeneratorChangesResult> {
  performance.mark(`run-sync-generator:${generatorSpecifier}:start`);
  const { collection, generator } = parseGeneratorString(generatorSpecifier);
  const { implementationFactory } = getGeneratorInformation(
    collection,
    generator,
    workspaceRoot,
    projects
  );
  const implementation = implementationFactory() as SyncGenerator;
  const result = await implementation(tree);

  let callback: GeneratorCallback | undefined;
  let outOfSyncMessage: string | undefined;
  if (result && typeof result === 'object') {
    callback = result.callback;
    outOfSyncMessage = result.outOfSyncMessage;
  }

  performance.mark(`run-sync-generator:${generatorSpecifier}:end`);
  performance.measure(
    `run-sync-generator:${generatorSpecifier}`,
    `run-sync-generator:${generatorSpecifier}:start`,
    `run-sync-generator:${generatorSpecifier}:end`
  );

  return {
    changes: tree.listChanges(),
    generatorName: generatorSpecifier,
    callback,
    outOfSyncMessage,
  };
}

export function collectEnabledTaskSyncGeneratorsFromProjectGraph(
  projectGraph: ProjectGraph,
  nxJson: NxJsonConfiguration
): Set<string> {
  const taskSyncGenerators = new Set<string>();
  const disabledTaskSyncGenerators = new Set(
    nxJson.sync?.disabledTaskSyncGenerators ?? []
  );

  for (const {
    data: { targets },
  } of Object.values(projectGraph.nodes)) {
    if (!targets) {
      continue;
    }

    for (const target of Object.values(targets)) {
      if (!target.syncGenerators?.length) {
        continue;
      }

      for (const generator of target.syncGenerators) {
        if (
          !disabledTaskSyncGenerators.has(generator) &&
          !taskSyncGenerators.has(generator)
        ) {
          taskSyncGenerators.add(generator);
        }
      }
    }
  }

  return taskSyncGenerators;
}

export function collectEnabledTaskSyncGeneratorsFromTaskGraph(
  taskGraph: TaskGraph,
  projectGraph: ProjectGraph,
  nxJson: NxJsonConfiguration
): Set<string> {
  const taskSyncGenerators = new Set<string>();
  const disabledTaskSyncGenerators = new Set(
    nxJson.sync?.disabledTaskSyncGenerators ?? []
  );

  for (const { target } of Object.values(taskGraph.tasks)) {
    const { syncGenerators } =
      projectGraph.nodes[target.project].data.targets[target.target];
    if (!syncGenerators?.length) {
      continue;
    }

    for (const generator of syncGenerators) {
      if (
        !disabledTaskSyncGenerators.has(generator) &&
        !taskSyncGenerators.has(generator)
      ) {
        taskSyncGenerators.add(generator);
      }
    }
  }

  return taskSyncGenerators;
}

export function collectRegisteredGlobalSyncGenerators(
  nxJson = readNxJson()
): Set<string> {
  const globalSyncGenerators = new Set<string>();

  if (!nxJson.sync?.globalGenerators?.length) {
    return globalSyncGenerators;
  }

  for (const generator of nxJson.sync.globalGenerators) {
    globalSyncGenerators.add(generator);
  }

  return globalSyncGenerators;
}

export function syncGeneratorResultsToMessageLines(
  results: SyncGeneratorChangesResult[]
): string[] {
  const messageLines: string[] = [];

  for (const result of results) {
    messageLines.push(
      `The ${chalk.bold(
        result.generatorName
      )} sync generator identified ${chalk.bold(result.changes.length)} file${
        result.changes.length === 1 ? '' : 's'
      } in the workspace that ${
        result.changes.length === 1 ? 'is' : 'are'
      } out of sync${result.outOfSyncMessage ? ':' : '.'}`
    );
    if (result.outOfSyncMessage) {
      messageLines.push(result.outOfSyncMessage);
    }
  }

  return messageLines;
}

async function runSyncGenerators(
  generators: string[]
): Promise<SyncGeneratorChangesResult[]> {
  const tree = new FsTree(workspaceRoot, false, 'running sync generators');
  const projectGraph = await createProjectGraphAsync();
  const { projects } = readProjectsConfigurationFromProjectGraph(projectGraph);

  const results: SyncGeneratorChangesResult[] = [];
  for (const generator of generators) {
    const result = await runSyncGenerator(tree, generator, projects);
    results.push(result);
  }

  return results;
}

async function flushSyncGeneratorChangesToDisk(
  results: SyncGeneratorChangesResult[]
): Promise<void> {
  performance.mark('flush-sync-generator-changes-to-disk:start');
  const { changes, createdFiles, updatedFiles, deletedFiles, callbacks } =
    processSyncGeneratorResults(results);
  // Write changes to disk
  flushChanges(workspaceRoot, changes);

  // Run the callbacks
  if (callbacks.length) {
    for (const callback of callbacks) {
      await callback();
    }
  }

  // Update the context files
  await updateContextWithChangedFiles(
    workspaceRoot,
    createdFiles,
    updatedFiles,
    deletedFiles
  );
  performance.mark('flush-sync-generator-changes-to-disk:end');
  performance.measure(
    'flush sync generator changes to disk',
    'flush-sync-generator-changes-to-disk:start',
    'flush-sync-generator-changes-to-disk:end'
  );
}

function processSyncGeneratorResults(results: SyncGeneratorChangesResult[]) {
  const changes: FileChange[] = [];
  const createdFiles: string[] = [];
  const updatedFiles: string[] = [];
  const deletedFiles: string[] = [];
  const callbacks: GeneratorCallback[] = [];

  for (const result of results) {
    if (result.callback) {
      callbacks.push(result.callback);
    }

    for (const change of result.changes) {
      changes.push(change);
      if (change.type === 'CREATE') {
        createdFiles.push(change.path);
      } else if (change.type === 'UPDATE') {
        updatedFiles.push(change.path);
      } else if (change.type === 'DELETE') {
        deletedFiles.push(change.path);
      }
    }
  }

  return { changes, createdFiles, updatedFiles, deletedFiles, callbacks };
}
