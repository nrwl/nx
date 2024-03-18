import type { Tree } from 'nx/src/generators/tree';
import type { ProjectGraph } from 'nx/src/config/project-graph';
import type { ProjectConfiguration } from 'nx/src/config/workspace-json-project-json';
import { requireNx } from '../../nx';

const { getProjects } = requireNx();

type CallBack<T> = (
  currentValue: T,
  project: string,
  target: string,
  configuration?: string
) => void;

/**
 * Calls a function for each different options that an executor is configured with
 */
export function forEachExecutorOptions<Options>(
  tree: Tree,
  /**
   * Name of the executor to update options for
   */
  executorName: string,
  /**
   * Callback that is called for each options configured for a builder
   */
  callback: CallBack<Options>
): void {
  forEachProjectConfig(getProjects(tree), executorName, callback);
}

/**
 * Calls a function for each different options that an executor is configured with via the project graph
 * this is helpful when you need to get the expaned configuration options from the nx.json
 **/
export function forEachExecutorOptionsInGraph<Options>(
  graph: ProjectGraph,
  executorName: string,
  callback: CallBack<Options>
): void {
  const projects = new Map<string, ProjectConfiguration>();
  Object.values(graph.nodes).forEach((p) => projects.set(p.name, p.data));

  forEachProjectConfig<Options>(projects, executorName, callback);
}

function forEachProjectConfig<Options>(
  projects: Map<string, ProjectConfiguration>,
  executorName: string,
  callback: CallBack<Options>
): void {
  for (const [projectName, project] of projects) {
    for (const [targetName, target] of Object.entries(project.targets || {})) {
      if (executorName !== target.executor) {
        continue;
      }

      if (target.options) {
        callback(target.options, projectName, targetName);
      }

      if (!target.configurations) {
        continue;
      }
      Object.entries(target.configurations).forEach(([configName, options]) => {
        callback(options, projectName, targetName, configName);
      });
    }
  }
}

// TODO: add a method for updating options
