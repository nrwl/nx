import { parseGeneratorString } from '../command-line/generate/generate';
import { getGeneratorInformation } from '../command-line/generate/generator-utils';
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

async function runSyncGenerators(generators: string[]): Promise<FileChange[]> {
  const tree = new FsTree(workspaceRoot, false, 'running sync generators');
  const projectGraph = await createProjectGraphAsync();
  const { projects } = readProjectsConfigurationFromProjectGraph(projectGraph);

  for (const generator of generators) {
    await runSyncGenerator(tree, generator, projects);
  }

  return tree.listChanges();
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
