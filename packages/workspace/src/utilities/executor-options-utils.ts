import { Tree, getProjects } from '@nrwl/devkit';

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
  callback: (
    currentValue: Options,
    project: string,
    target: string,
    configuration?: string
  ) => void
) {
  for (const [projectName, project] of getProjects(tree)) {
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
