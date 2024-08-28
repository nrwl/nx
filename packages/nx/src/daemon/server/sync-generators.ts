import { readNxJson } from '../../config/nx-json';
import type { ProjectGraph } from '../../config/project-graph';
import type { ProjectConfiguration } from '../../config/workspace-json-project-json';
import { FsTree } from '../../generators/tree';
import { hashArray } from '../../hasher/file-hasher';
import { readProjectsConfigurationFromProjectGraph } from '../../project-graph/project-graph';
import {
  collectEnabledTaskSyncGeneratorsFromProjectGraph,
  collectRegisteredGlobalSyncGenerators,
  flushSyncGeneratorChanges,
  runSyncGenerator,
  type SyncGeneratorChangesResult,
} from '../../utils/sync-generators';
import { workspaceRoot } from '../../utils/workspace-root';
import { serverLogger } from './logger';
import { getCachedSerializedProjectGraphPromise } from './project-graph-incremental-recomputation';

const syncGeneratorsCacheResultPromises = new Map<
  string,
  Promise<SyncGeneratorChangesResult>
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

// TODO(leo): check conflicts and reuse the Tree where possible
export async function getCachedSyncGeneratorChanges(
  generators: string[]
): Promise<SyncGeneratorChangesResult[]> {
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
              runGenerator(generator, projects);
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
  } catch (e) {
    console.error(e);
    syncGeneratorsCacheResultPromises.clear();

    return [];
  }
}

export async function flushSyncGeneratorChangesToDisk(
  generators: string[]
): Promise<void> {
  log('flush sync generators changes', generators);

  const results = await getCachedSyncGeneratorChanges(generators);

  for (const generator of generators) {
    syncGeneratorsCacheResultPromises.delete(generator);
  }

  await flushSyncGeneratorChanges(results);
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
      runGenerator(generator, projects);
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
  projects: Record<string, ProjectConfiguration>
): void {
  log('running scheduled generator', generator);
  // remove it from the scheduled set
  scheduledGenerators.delete(generator);
  const tree = new FsTree(
    workspaceRoot,
    false,
    `running sync generator ${generator}`
  );

  // run the generator and cache the result
  syncGeneratorsCacheResultPromises.set(
    generator,
    runSyncGenerator(tree, generator, projects).then((result) => {
      log(generator, 'changes:', result.changes.map((c) => c.path).join(', '));
      return result;
    })
  );
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
