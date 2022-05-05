import { workspaceConfigName } from 'nx/src/config/workspaces';
import { workspaceRoot } from 'nx/src/utils/app-root';
import { resolveLocalNxPlugin } from 'nx/src/utils/nx-plugin';
import { ProjectGraphProcessorContext } from '../../config/project-graph';
import { ProjectGraphBuilder } from '../project-graph-builder';

export function buildExecutorDependencies(
  context: ProjectGraphProcessorContext,
  builder: ProjectGraphBuilder
) {
  const projects = Object.entries(context.workspace.projects);
  // Adds an implicit dependency between any project that
  // consumes a local plugin's executor and the local plugin
  for (const [project, configuration] of projects) {
    const executorCollectionsUsed = Object.values(
      configuration.targets || {}
    ).map((x) => x.executor.split(':')[0]);

    for (const collection of executorCollectionsUsed) {
      const localPluginProject = resolveLocalNxPlugin(collection)?.projectName;
      if (localPluginProject) {
        builder.addImplicitDependency(project, localPluginProject);
      } else {
        const node = builder.graph.externalNodes[`npm:${collection}`];
        if (node) {
          builder.addImplicitDependency(project, node.name);
        }
      }
    }
  }
}
