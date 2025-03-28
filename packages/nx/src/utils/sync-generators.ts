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

export type SyncGeneratorRunSuccessResult = {
  generatorName: string;
  changes: FileChange[];
  callback?: GeneratorCallback;
  outOfSyncMessage?: string;
};

// Error is not serializable, so we use a simple object instead
type SerializableSimpleError = {
  message: string;
  stack: string | undefined;
  title?: string;
  bodyLines?: string[];
};

export type SyncGeneratorRunErrorResult = {
  generatorName: string;
  error: SerializableSimpleError;
};

export type SyncGeneratorRunResult =
  | SyncGeneratorRunSuccessResult
  | SyncGeneratorRunErrorResult;

type FlushSyncGeneratorChangesSuccess = { success: true };
type FlushSyncGeneratorFailure = {
  generator: string;
  error: SerializableSimpleError;
};
type FlushSyncGeneratorChangesFailure = {
  generatorFailures: FlushSyncGeneratorFailure[];
  generalFailure?: SerializableSimpleError;
};
export type FlushSyncGeneratorChangesResult =
  | FlushSyncGeneratorChangesSuccess
  | FlushSyncGeneratorChangesFailure;

export class SyncError extends Error {
  constructor(public title: string, public bodyLines?: string[]) {
    super(title);
    this.name = this.constructor.name;
  }
}

export async function getSyncGeneratorChanges(
  generators: string[]
): Promise<SyncGeneratorRunResult[]> {
  performance.mark('get-sync-generators-changes:start');
  let results: SyncGeneratorRunResult[];

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

  return results.filter((r) => ('error' in r ? true : r.changes.length > 0));
}

export async function flushSyncGeneratorChanges(
  results: SyncGeneratorRunResult[]
): Promise<FlushSyncGeneratorChangesResult> {
  if (isOnDaemon() || !daemonClient.enabled()) {
    return await flushSyncGeneratorChangesToDisk(results);
  }

  return await daemonClient.flushSyncGeneratorChangesToDisk(
    results.map((r) => r.generatorName)
  );
}

export async function collectAllRegisteredSyncGenerators(
  projectGraph: ProjectGraph,
  nxJson: NxJsonConfiguration
): Promise<{
  globalGenerators: string[];
  taskGenerators: string[];
}> {
  if (!daemonClient.enabled()) {
    return {
      globalGenerators: [...collectRegisteredGlobalSyncGenerators()],
      taskGenerators: [
        ...collectEnabledTaskSyncGeneratorsFromProjectGraph(
          projectGraph,
          nxJson
        ),
      ],
    };
  }

  return await daemonClient.getRegisteredSyncGenerators();
}

export async function runSyncGenerator(
  tree: Tree,
  generatorSpecifier: string,
  projects: Record<string, ProjectConfiguration>
): Promise<SyncGeneratorRunResult> {
  try {
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
  } catch (e) {
    return {
      generatorName: generatorSpecifier,
      error: toSerializableError(e),
    };
  }
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

export function getSyncGeneratorSuccessResultsMessageLines(
  results: SyncGeneratorRunResult[]
): string[] {
  const messageLines: string[] = [];

  for (const result of results) {
    if ('error' in result) {
      continue;
    }

    messageLines.push(
      `[${chalk.bold(result.generatorName)}]: ${
        result.outOfSyncMessage ?? `Some files are out of sync.`
      }`
    );
  }

  return messageLines;
}

export function getFailedSyncGeneratorsFixMessageLines(
  results: SyncGeneratorRunResult[],
  verbose: boolean,
  globalGeneratorSet: Set<string> = new Set()
): string[] {
  const messageLines: string[] = [];
  const globalGenerators: string[] = [];
  const taskGenerators: string[] = [];
  let isFirst = true;
  for (const result of results) {
    if ('error' in result) {
      if (!isFirst && verbose) {
        messageLines.push('');
      }
      isFirst = false;
      messageLines.push(
        `[${chalk.bold(result.generatorName)}]: ${errorToString(
          result.error,
          verbose
        )}`
      );

      if (globalGeneratorSet.has(result.generatorName)) {
        globalGenerators.push(result.generatorName);
      } else {
        taskGenerators.push(result.generatorName);
      }
    }
  }

  messageLines.push(
    ...getFailedSyncGeneratorsMessageLines(
      taskGenerators,
      globalGenerators,
      verbose
    )
  );

  return messageLines;
}

export function getFlushFailureMessageLines(
  result: FlushSyncGeneratorChangesFailure,
  verbose: boolean,
  globalGeneratorSet: Set<string> = new Set()
): string[] {
  const messageLines: string[] = [];
  const globalGenerators: string[] = [];
  const taskGenerators: string[] = [];
  let isFirst = true;
  for (const failure of result.generatorFailures) {
    if (!isFirst && verbose) {
      messageLines.push('');
    }
    isFirst = false;
    messageLines.push(
      `[${chalk.bold(failure.generator)}]: ${errorToString(
        failure.error,
        verbose
      )}`
    );

    if (globalGeneratorSet.has(failure.generator)) {
      globalGenerators.push(failure.generator);
    } else {
      taskGenerators.push(failure.generator);
    }
  }

  messageLines.push(
    ...getFailedSyncGeneratorsMessageLines(
      taskGenerators,
      globalGenerators,
      verbose
    )
  );

  if (result.generalFailure) {
    if (messageLines.length > 0) {
      messageLines.push('');
      messageLines.push('Additionally, an unexpected error occurred:');
    } else {
      messageLines.push('An unexpected error occurred:');
    }

    messageLines.push(
      ...[
        '',
        result.generalFailure.message,
        ...(!!result.generalFailure.stack
          ? [`\n${result.generalFailure.stack}`]
          : []),
        '',
        'Please report the error at: https://github.com/nrwl/nx/issues/new/choose',
      ]
    );
  }

  return messageLines;
}

export function processSyncGeneratorResultErrors(
  results: SyncGeneratorRunResult[]
) {
  let failedGeneratorsCount = 0;
  for (const result of results) {
    if ('error' in result) {
      failedGeneratorsCount++;
    }
  }
  const areAllResultsFailures = failedGeneratorsCount === results.length;
  const anySyncGeneratorsFailed = failedGeneratorsCount > 0;

  return {
    failedGeneratorsCount,
    areAllResultsFailures,
    anySyncGeneratorsFailed,
  };
}

async function runSyncGenerators(
  generators: string[]
): Promise<SyncGeneratorRunResult[]> {
  const tree = new FsTree(workspaceRoot, false, 'running sync generators');
  const projectGraph = await createProjectGraphAsync();
  const { projects } = readProjectsConfigurationFromProjectGraph(projectGraph);

  const results: SyncGeneratorRunResult[] = [];
  for (const generator of generators) {
    const result = await runSyncGenerator(tree, generator, projects);
    results.push(result);
  }

  return results;
}

async function flushSyncGeneratorChangesToDisk(
  results: SyncGeneratorRunResult[]
): Promise<FlushSyncGeneratorChangesResult> {
  performance.mark('flush-sync-generator-changes-to-disk:start');

  const createdFiles: string[] = [];
  const updatedFiles: string[] = [];
  const deletedFiles: string[] = [];
  const generatorFailures: FlushSyncGeneratorFailure[] = [];

  for (const result of results) {
    if ('error' in result) {
      continue;
    }

    for (const change of result.changes) {
      if (change.type === 'CREATE') {
        createdFiles.push(change.path);
      } else if (change.type === 'UPDATE') {
        updatedFiles.push(change.path);
      } else if (change.type === 'DELETE') {
        deletedFiles.push(change.path);
      }
    }

    try {
      // Write changes to disk
      flushChanges(workspaceRoot, result.changes);
      // Run the callback
      if (result.callback) {
        await result.callback();
      }
    } catch (e) {
      generatorFailures.push({
        generator: result.generatorName,
        error: toSerializableError(e),
      });
    }
  }

  try {
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
  } catch (e) {
    return {
      generatorFailures,
      generalFailure: toSerializableError(e),
    };
  }

  return generatorFailures.length > 0
    ? { generatorFailures }
    : { success: true };
}

function getFailedSyncGeneratorsMessageLines(
  taskGenerators: string[],
  globalGenerators: string[],
  verbose: boolean
): string[] {
  const messageLines: string[] = [];

  if (taskGenerators.length + globalGenerators.length === 1) {
    messageLines.push(
      '',
      verbose
        ? 'Please check the error above and address the issue.'
        : 'Please check the error above and address the issue. You can provide the `--verbose` flag to get more details.'
    );
    if (taskGenerators.length === 1) {
      messageLines.push(
        `If needed, you can disable the failing sync generator by setting \`sync.disabledTaskSyncGenerators: ["${taskGenerators[0]}"]\` in your \`nx.json\`.`
      );
    } else {
      messageLines.push(
        `If needed, you can remove the failing global sync generator "${globalGenerators[0]}" from the \`sync.globalGenerators\` array in your \`nx.json\`.`
      );
    }
  } else if (taskGenerators.length + globalGenerators.length > 1) {
    messageLines.push(
      '',
      verbose
        ? 'Please check the errors above and address the issues.'
        : 'Please check the errors above and address the issues. You can provide the `--verbose` flag to get more details.'
    );
    if (taskGenerators.length > 0) {
      const generatorsString = taskGenerators.map((g) => `"${g}"`).join(', ');
      messageLines.push(
        `If needed, you can disable the failing task sync generators by setting \`sync.disabledTaskSyncGenerators: [${generatorsString}]\` in your \`nx.json\`.`
      );
    }
    if (globalGenerators.length > 0) {
      const lastGenerator = globalGenerators.pop();
      const generatorsString =
        globalGenerators.length > 0
          ? `${globalGenerators
              .map((g) => `"${g}"`)
              .join(', ')} and "${lastGenerator}"`
          : `"${lastGenerator}"`;
      messageLines.push(
        `If needed, you can remove the failing global sync generators ${generatorsString} from the \`sync.globalGenerators\` array in your \`nx.json\`.`
      );
    }
  }

  return messageLines;
}

function errorToString(error: SerializableSimpleError, verbose: boolean) {
  if (error.title) {
    let message = `${chalk.red(error.title)}`;
    if (error.bodyLines?.length) {
      message += `

  ${error.bodyLines
    .map((bodyLine) => `${bodyLine.split('\n').join('\n  ')}`)
    .join('\n  ')}`;

      return message;
    }
  }

  return `${chalk.red(error.message)}${
    verbose && error.stack ? '\n  ' + error.stack : ''
  }`;
}

function toSerializableError(error: Error): SerializableSimpleError {
  return error instanceof SyncError
    ? {
        title: error.title,
        bodyLines: error.bodyLines,
        message: error.message,
        stack: error.stack,
      }
    : { message: error.message, stack: error.stack };
}
