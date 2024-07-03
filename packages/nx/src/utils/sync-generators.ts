import { parseGeneratorString } from '../command-line/generate/generate';
import { getGeneratorInformation } from '../command-line/generate/generator-utils';
import type { ProjectConfiguration } from '../config/workspace-json-project-json';
import { daemonClient } from '../daemon/client/client';
import { isOnDaemon } from '../daemon/is-on-daemon';
import { FsTree, type FileChange } from '../generators/tree';
import {
  createProjectGraphAsync,
  readProjectsConfigurationFromProjectGraph,
} from '../project-graph/project-graph';
import { workspaceRoot } from './workspace-root';

export async function getSyncGeneratorChanges(
  generators: string[]
): Promise<FileChange[]> {
  if (isOnDaemon() || !daemonClient.enabled()) {
    return await runSyncGenerators(generators);
  }

  // TODO(leo): look into registering the generators with the daemon and let it run them in the background when changes are detected
  return await daemonClient.getSyncGeneratorChanges(generators);
}

async function runSyncGenerators(generators: string[]): Promise<FileChange[]> {
  const tree = new FsTree(workspaceRoot, false, 'running sync generators');
  const projectGraph = isOnDaemon()
    ? (await daemonClient.getProjectGraphAndSourceMaps()).projectGraph
    : await createProjectGraphAsync();
  const { projects } = readProjectsConfigurationFromProjectGraph(projectGraph);

  for (const generator of generators) {
    await runGenerator(tree, generator, projects);
  }

  return tree.listChanges();
}

async function runGenerator(
  tree: FsTree,
  generatorSpecifier: string,
  projects: Record<string, ProjectConfiguration>
): Promise<void> {
  const { collection, generator } = parseGeneratorString(generatorSpecifier);
  const { implementationFactory } = getGeneratorInformation(
    collection,
    generator,
    workspaceRoot,
    projects
  );
  const implementation = implementationFactory();
  await implementation(tree, {});
}
