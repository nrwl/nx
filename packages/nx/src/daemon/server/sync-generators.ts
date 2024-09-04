import { readNxJson } from '../../config/nx-json';
import type { ProjectGraph } from '../../config/project-graph';
import type { ProjectConfiguration } from '../../config/workspace-json-project-json';
import { FsTree, type Tree } from '../../generators/tree';
import { hashArray } from '../../hasher/file-hasher';
import { readProjectsConfigurationFromProjectGraph } from '../../project-graph/project-graph';
import {
  collectEnabledTaskSyncGeneratorsFromProjectGraph,
  collectRegisteredGlobalSyncGenerators,
  flushSyncGeneratorChanges,
  runSyncGenerator,
  type FlushSyncGeneratorChangesResult,
  type SyncGeneratorRunResult,
  type SyncGeneratorRunSuccessResult,
} from '../../utils/sync-generators';
import { workspaceRoot } from '../../utils/workspace-root';
import { serverLogger } from './logger';
import { getCachedSerializedProjectGraphPromise } from './project-graph-incremental-recomputation';

const syncGeneratorsCacheResultPromises = new Map<
  string,
  Promise<SyncGeneratorRunResult>
>();
let registeredTaskSyncGenerators = new Set<string>();
let registeredGlobalSyncGenerators = new Set<string>();
const scheduledGenerators = new Set<string>();

let waitPeriod = 100;
let registeredSyncGenerators: Set<string> | undefined;
let scheduledTimeoutId: NodeJS.Timeout | undefined;
let storedProjectGraphHash: string | undefined;
let storedNxJsonHash: string | undefined;
let storedDisabledTaskSyncGeneratorsHash: string | undefined;

const log = (...messageParts: unknown[]) => {
  serverLogger.log('[SYNC]:', ...messageParts);
};

export async function getCachedSyncGeneratorChanges(
  generators: string[]
): Promise<SyncGeneratorRunResult[]> {
  try {
    log('get sync generators changes on demand', generators);
    // this is invoked imperatively, so we clear any scheduled run
    if (scheduledTimeoutId) {
      log('clearing scheduled run');
      clearTimeout(scheduledTimeoutId);
      scheduledTimeoutId = undefined;
    }

    // reset the wait time
    waitPeriod = 100;

    const results = await getFromCacheOrRunGenerators(generators);

    const conflicts = _getConflictingGeneratorGroups(results);
    if (!conflicts.length) {
      // there are no conflicts
      return results;
    }

    // there are conflicts, so we need to re-run the conflicting generators
    // using the same tree
    return await processConflictingGenerators(conflicts, results);
  } catch (e) {
    console.error(e);
    syncGeneratorsCacheResultPromises.clear();

    return [];
  }
}

export async function flushSyncGeneratorChangesToDisk(
  generators: string[]
): Promise<FlushSyncGeneratorChangesResult> {
  log('flush sync generators changes', generators);

  const results = await getCachedSyncGeneratorChanges(generators);

  for (const generator of generators) {
    syncGeneratorsCacheResultPromises.delete(generator);
  }

  return await flushSyncGeneratorChanges(results);
}

export function collectAndScheduleSyncGenerators(
  projectGraph: ProjectGraph
): void {
  if (!projectGraph) {
    // If the project graph is not available, we can't collect and schedule
    // sync generators. The project graph error will be reported separately.
    return;
  }

  log('collect registered sync generators');
  collectAllRegisteredSyncGenerators(projectGraph);

  // a change imply we need to re-run all the generators
  // make sure to schedule all the collected generators
  scheduledGenerators.clear();

  if (!registeredSyncGenerators.size) {
    // there are no generators to run
    return;
  }

  for (const generator of registeredSyncGenerators) {
    scheduledGenerators.add(generator);
  }

  log('scheduling:', [...scheduledGenerators]);

  if (scheduledTimeoutId) {
    // we have a scheduled run already, so we don't need to do anything
    return;
  }

  scheduledTimeoutId = setTimeout(async () => {
    scheduledTimeoutId = undefined;
    if (waitPeriod < 4000) {
      waitPeriod = waitPeriod * 2;
    }

    if (scheduledGenerators.size === 0) {
      // no generators to run
      return;
    }

    const { projects } =
      readProjectsConfigurationFromProjectGraph(projectGraph);

    for (const generator of scheduledGenerators) {
      syncGeneratorsCacheResultPromises.set(
        generator,
        runGenerator(generator, projects)
      );
    }

    await Promise.all(syncGeneratorsCacheResultPromises.values());
  }, waitPeriod);
}

export async function getCachedRegisteredSyncGenerators(): Promise<string[]> {
  log('get registered sync generators');
  if (!registeredSyncGenerators) {
    log('no registered sync generators, collecting them');
    const { projectGraph } = await getCachedSerializedProjectGraphPromise();
    collectAllRegisteredSyncGenerators(projectGraph);
  } else {
    log('registered sync generators already collected, returning them');
  }

  return [...registeredSyncGenerators];
}

async function getFromCacheOrRunGenerators(
  generators: string[]
): Promise<SyncGeneratorRunResult[]> {
  let projects: Record<string, ProjectConfiguration> | null;
  let errored = false;
  const getProjectsConfigurations = async () => {
    if (projects || errored) {
      return projects;
    }

    const { projectGraph, error } =
      await getCachedSerializedProjectGraphPromise();
    projects = projectGraph
      ? readProjectsConfigurationFromProjectGraph(projectGraph).projects
      : null;
    errored = error !== undefined;

    return projects;
  };

  return (
    await Promise.all(
      generators.map(async (generator) => {
        if (
          scheduledGenerators.has(generator) ||
          !syncGeneratorsCacheResultPromises.has(generator)
        ) {
          // it's scheduled to run (there are pending changes to process) or
          // it's not scheduled and there's no cached result, so run it
          const projects = await getProjectsConfigurations();
          if (projects) {
            log(generator, 'already scheduled or not cached, running it now');
            syncGeneratorsCacheResultPromises.set(
              generator,
              runGenerator(generator, projects)
            );
          } else {
            log(
              generator,
              'already scheduled or not cached, project graph errored'
            );
            /**
             * This should never happen. This is invoked imperatively, and by
             * the time it is invoked, the project graph would have already
             * been requested. If it errored, it would have been reported and
             * this wouldn't have been invoked. We handle it just in case.
             *
             * Since the project graph would be reported by the relevant
             * handlers separately, we just ignore the error, don't cache
             * any result and return an empty result, the next time this is
             * invoked the process will repeat until it eventually recovers
             * when the project graph is fixed.
             */
            return Promise.resolve({ changes: [], generatorName: generator });
          }
        } else {
          log(
            generator,
            'not scheduled and has cached result, returning cached result'
          );
        }

        return syncGeneratorsCacheResultPromises.get(generator);
      })
    )
  ).flat();
}

async function runConflictingGenerators(
  tree: Tree,
  generators: string[]
): Promise<SyncGeneratorRunResult[]> {
  const { projectGraph } = await getCachedSerializedProjectGraphPromise();
  const projects = projectGraph
    ? readProjectsConfigurationFromProjectGraph(projectGraph).projects
    : null;

  if (!projects) {
    /**
     * This should never happen. This is invoked imperatively, and by
     * the time it is invoked, the project graph would have already
     * been requested. If it errored, it would have been reported and
     * this wouldn't have been invoked. We handle it just in case.
     *
     * Since the project graph would be reported by the relevant
     * handlers separately, we just ignore the error.
     */
    return generators.map((generator) => ({
      changes: [],
      generatorName: generator,
    }));
  }

  // we need to run conflicting generators sequentially because they use the same tree
  const results: SyncGeneratorRunResult[] = [];
  for (const generator of generators) {
    log(generator, 'running it now');
    results.push(await runGenerator(generator, projects, tree));
  }

  return results;
}

async function processConflictingGenerators(
  conflicts: string[][],
  initialResults: SyncGeneratorRunResult[]
): Promise<SyncGeneratorRunResult[]> {
  const conflictRunResults = (
    await Promise.all(
      conflicts.map((generators) => {
        const [firstGenerator, ...generatorsToRun] = generators;
        // it must exists because the conflicts were identified from the initial results
        // and it's guaranteed to be a success result
        const firstGeneratorResult = initialResults.find(
          (r) => r.generatorName === firstGenerator
        )! as SyncGeneratorRunSuccessResult;

        const tree = new FsTree(
          workspaceRoot,
          false,
          `running sync generators ${generators.join(',')}`
        );
        // pre-apply the changes from the first generator to avoid running it
        for (const change of firstGeneratorResult.changes) {
          if (change.type === 'CREATE' || change.type === 'UPDATE') {
            tree.write(change.path, change.content, change.options);
          } else if (change.type === 'DELETE') {
            tree.delete(change.path);
          }
        }

        /**
         * We don't cache the results of conflicting generators because they
         * use the same tree, so some files might contain results from multiple
         * generators and we don't have guarantees that the same combination of
         * generators will run together.
         */
        return runConflictingGenerators(tree, generatorsToRun);
      })
    )
  ).flat();

  /**
   * The order of the results from the re-run generators is important because
   * the last result from a group of conflicting generators will contain the
   * changes from the previous conflicting generators. So, instead of replacing
   * in-place the initial results, we first add the results from the re-run
   * generators, and then add the initial results that were not from a
   * conflicting generator.
   */
  const results = [...conflictRunResults];
  for (const result of initialResults) {
    if (
      conflictRunResults.every((r) => r.generatorName !== result.generatorName)
    ) {
      // this result is not from a conflicting generator, so we add it to the
      // results
      results.push(result);
    }
  }

  return results;
}

/**
 * @internal
 */
export function _getConflictingGeneratorGroups(
  results: SyncGeneratorRunResult[]
): string[][] {
  const changedFileToGeneratorMap = new Map<string, Set<string>>();
  for (const result of results) {
    if ('error' in result) {
      continue;
    }

    for (const change of result.changes) {
      if (!changedFileToGeneratorMap.has(change.path)) {
        changedFileToGeneratorMap.set(change.path, new Set());
      }
      changedFileToGeneratorMap.get(change.path)!.add(result.generatorName);
    }
  }

  const conflicts: Set<string>[] = [];
  for (const generatorSet of changedFileToGeneratorMap.values()) {
    if (generatorSet.size === 1) {
      // no conflicts
      continue;
    }

    if (conflicts.length === 0) {
      // there are no conflicts yet, so we just add the first group
      conflicts.push(new Set(generatorSet));
      continue;
    }

    // identify if any of the current generator sets intersect with any of the
    // existing conflict groups
    const generatorsArray = Array.from(generatorSet);
    const existingConflictGroup = conflicts.find((group) =>
      generatorsArray.some((generator) => group.has(generator))
    );
    if (existingConflictGroup) {
      // there's an intersecting group, so we merge the two
      for (const generator of generatorsArray) {
        existingConflictGroup.add(generator);
      }
    } else {
      // there's no intersecting group, so we create a new one
      conflicts.push(new Set(generatorsArray));
    }
  }

  return conflicts.map((group) => Array.from(group));
}

function collectAllRegisteredSyncGenerators(projectGraph: ProjectGraph): void {
  const nxJson = readNxJson();
  const projectGraphHash = hashProjectGraph(projectGraph);
  const disabledTaskSyncGeneratorsHash = hashArray(
    nxJson.sync?.disabledTaskSyncGenerators?.sort() ?? []
  );
  if (
    projectGraphHash !== storedProjectGraphHash ||
    disabledTaskSyncGeneratorsHash !== storedDisabledTaskSyncGeneratorsHash
  ) {
    storedProjectGraphHash = projectGraphHash;
    storedDisabledTaskSyncGeneratorsHash = disabledTaskSyncGeneratorsHash;
    registeredTaskSyncGenerators =
      collectEnabledTaskSyncGeneratorsFromProjectGraph(projectGraph, nxJson);
  } else {
    log('project graph hash is the same, not collecting task sync generators');
  }

  const nxJsonHash = hashArray(nxJson.sync?.globalGenerators?.sort() ?? []);
  if (storedNxJsonHash !== nxJsonHash) {
    storedNxJsonHash = nxJsonHash;
    registeredGlobalSyncGenerators =
      collectRegisteredGlobalSyncGenerators(nxJson);
  } else {
    log('nx.json hash is the same, not collecting global sync generators');
  }

  const generators = new Set([
    ...registeredTaskSyncGenerators,
    ...registeredGlobalSyncGenerators,
  ]);

  if (!registeredSyncGenerators) {
    registeredSyncGenerators = generators;
    return;
  }

  for (const generator of registeredSyncGenerators) {
    if (!generators.has(generator)) {
      registeredSyncGenerators.delete(generator);
      syncGeneratorsCacheResultPromises.delete(generator);
    }
  }

  for (const generator of generators) {
    if (!registeredSyncGenerators.has(generator)) {
      registeredSyncGenerators.add(generator);
    }
  }
}

function runGenerator(
  generator: string,
  projects: Record<string, ProjectConfiguration>,
  tree?: Tree
): Promise<SyncGeneratorRunResult> {
  log('running scheduled generator', generator);
  // remove it from the scheduled set
  scheduledGenerators.delete(generator);
  tree ??= new FsTree(
    workspaceRoot,
    false,
    `running sync generator ${generator}`
  );

  return runSyncGenerator(tree, generator, projects).then((result) => {
    if ('error' in result) {
      log(generator, 'error:', result.error.message);
    } else {
      log(generator, 'changes:', result.changes.map((c) => c.path).join(', '));
    }
    return result;
  });
}

function hashProjectGraph(projectGraph: ProjectGraph): string {
  const stringifiedProjects = Object.entries(projectGraph.nodes)
    .sort(([projectNameA], [projectNameB]) =>
      projectNameA.localeCompare(projectNameB)
    )
    .map(
      ([projectName, projectConfig]) =>
        `${projectName}:${JSON.stringify(projectConfig)}`
    );

  return hashArray(stringifiedProjects);
}
