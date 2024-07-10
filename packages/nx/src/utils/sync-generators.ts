import { parseGeneratorString } from '../command-line/generate/generate';
import { getGeneratorInformation } from '../command-line/generate/generator-utils';
import { readNxJson } from '../config/nx-json';
import type { ProjectGraph } from '../config/project-graph';
import type { ProjectConfiguration } from '../config/workspace-json-project-json';
import { daemonClient } from '../daemon/client/client';
import { FsTree, type FileChange } from '../generators/tree';
import {
  createProjectGraphAsync,
  readProjectsConfigurationFromProjectGraph,
} from '../project-graph/project-graph';
import { workspaceRoot } from './workspace-root';

export async function getSyncGeneratorChanges(
  generators: string[]
): Promise<FileChange[]> {
  if (!daemonClient.enabled()) {
    return await runSyncGenerators(generators);
  }

  return await daemonClient.getSyncGeneratorChanges(generators);
}

export async function collectAllRegisteredSyncGenerators(
  projectGraph: ProjectGraph
): Promise<string[]> {
  if (!daemonClient.enabled()) {
    return [
      ...collectRegisteredTaskSyncGenerators(projectGraph),
      ...collectRegisteredGlobalSyncGenerators(),
    ];
  }

  return await daemonClient.getRegisteredSyncGenerators();
}

export async function runSyncGenerator(
  tree: FsTree,
  generatorSpecifier: string,
  projects: Record<string, ProjectConfiguration>
): Promise<FileChange[]> {
  const { collection, generator } = parseGeneratorString(generatorSpecifier);
  const { implementationFactory } = getGeneratorInformation(
    collection,
    generator,
    workspaceRoot,
    projects
  );
  const implementation = implementationFactory();
  await implementation(tree, {});

  return tree.listChanges();
}

export function collectRegisteredTaskSyncGenerators(
  projectGraph: ProjectGraph
): Set<string> {
  const taskSyncGenerators = new Set<string>();

  for (const {
    data: { targets },
  } of Object.values(projectGraph.nodes)) {
    if (!targets) {
      continue;
    }

    for (const target of Object.values(targets)) {
      if (!target.syncGenerators) {
        continue;
      }

      for (const generator of target.syncGenerators) {
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

async function runSyncGenerators(generators: string[]): Promise<FileChange[]> {
  const tree = new FsTree(workspaceRoot, false, 'running sync generators');
  const projectGraph = await createProjectGraphAsync();
  const { projects } = readProjectsConfigurationFromProjectGraph(projectGraph);

  for (const generator of generators) {
    await runSyncGenerator(tree, generator, projects);
  }

  return tree.listChanges();
}
