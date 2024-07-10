import { readNxJson } from '../../config/nx-json';
import type { ProjectGraph } from '../../config/project-graph';
import type { ProjectConfiguration } from '../../config/workspace-json-project-json';
import { FsTree, type FileChange } from '../../generators/tree';
import { hashArray } from '../../hasher/file-hasher';
import { readProjectsConfigurationFromProjectGraph } from '../../project-graph/project-graph';
import {
  collectRegisteredGlobalSyncGenerators,
  collectRegisteredTaskSyncGenerators,
  runSyncGenerator,
} from '../../utils/sync-generators';
import { workspaceRoot } from '../../utils/workspace-root';
import { serverLogger } from './logger';
import { getCachedSerializedProjectGraphPromise } from './project-graph-incremental-recomputation';

const syncGeneratorsCacheResultPromises = new Map<
  string,
  Promise<FileChange[]> | undefined
>();
let registeredTaskSyncGenerators = new Set<string>();
let registeredGlobalSyncGenerators = new Set<string>();
const scheduledGenerators = new Set<string>();

let waitPeriod = 100;
let registeredSyncGenerators: Set<string> | undefined;
let scheduledTimeoutId: NodeJS.Timeout | undefined;
let storedProjectGraphHash: string | undefined;
let storedNxJsonHash: string | undefined;

// TODO(leo): check conflicts and reuse the Tree where possible
export async function getCachedSyncGeneratorChanges(
  generators: string[]
): Promise<FileChange[]> {
  try {
    // this is invoked imperatively, so we clear any scheduled run
    if (scheduledTimeoutId) {
      clearTimeout(scheduledTimeoutId);
      scheduledTimeoutId = undefined;
    }

    // reset the wait time
    waitPeriod = 100;

    let projects: Record<string, ProjectConfiguration>;
    const getProjectsConfigurations = async () => {
      if (projects) {
        return projects;
      }

      const { projectGraph } = await getCachedSerializedProjectGraphPromise();
      projects =
        readProjectsConfigurationFromProjectGraph(projectGraph).projects;

      return projects;
    };

    return (
      await Promise.all(
        generators.map(async (generator) => {
          serverLogger.log('on demand generator', generator);
          if (scheduledGenerators.has(generator)) {
            serverLogger.log('already scheduled', generator, 'run it now');
            // it's scheduled to run, so there are pending changes, run it
            runGenerator(generator, await getProjectsConfigurations());
          } else if (!syncGeneratorsCacheResultPromises.has(generator)) {
            serverLogger.log('not scheduled and no cached result', generator);
            // it's not scheduled and there's no cached result, so run it
            runGenerator(generator, await getProjectsConfigurations());
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

export function collectAndScheduleSyncGenerators(
  projectGraph: ProjectGraph
): void {
  serverLogger.log('collect registered sync generators');
  collectAllRegisteredSyncGenerators(projectGraph);

  // a change imply we need to re-run all the generators
  // make sure to schedule all the collected generators
  scheduledGenerators.clear();
  for (const generator of registeredSyncGenerators) {
    scheduledGenerators.add(generator);
  }

  serverLogger.log('scheduledGenerators', [...scheduledGenerators]);

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
  if (!registeredSyncGenerators) {
    const { projectGraph } = await getCachedSerializedProjectGraphPromise();
    collectAllRegisteredSyncGenerators(projectGraph);
  }

  return [...registeredSyncGenerators];
}

function collectAllRegisteredSyncGenerators(projectGraph: ProjectGraph): void {
  const projectGraphHash = hashProjectGraph(projectGraph);
  if (storedProjectGraphHash !== projectGraphHash) {
    storedProjectGraphHash = projectGraphHash;
    registeredTaskSyncGenerators =
      collectRegisteredTaskSyncGenerators(projectGraph);
  }

  const nxJson = readNxJson();
  const nxJsonHash = hashArray(nxJson.sync?.globalGenerators?.sort() ?? []);
  if (storedNxJsonHash !== nxJsonHash) {
    storedNxJsonHash = nxJsonHash;
    registeredGlobalSyncGenerators =
      collectRegisteredGlobalSyncGenerators(nxJson);
  }

  const generators = new Set<string>([
    ...registeredTaskSyncGenerators,
    ...registeredGlobalSyncGenerators,
  ]);

  if (!registeredSyncGenerators) {
    registeredSyncGenerators = new Set(generators);
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
  serverLogger.log('running scheduled generator', generator);
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
    runSyncGenerator(tree, generator, projects)
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
