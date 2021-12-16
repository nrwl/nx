import { ExecutorContext, ProjectGraph } from '@nrwl/devkit';
import { readCachedProjectGraph } from '@nrwl/workspace/src/core/project-graph';
import {
  calculateProjectDependencies,
  checkDependentProjectsHaveBeenBuilt,
  createTmpTsConfig,
} from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import { join } from 'path';

export function checkDependencies(
  context: ExecutorContext,
  tsConfigPath: string
): {
  tmpTsConfig: string | null;
  projectRoot: string;
} {
  const projectGraph = readCachedProjectGraph();
  const { target, dependencies, nonBuildableDependencies } =
    calculateProjectDependencies(
      projectGraph,
      context.root,
      context.projectName,
      context.targetName,
      context.configurationName
    );
  const projectRoot = target.data.root;

  if (nonBuildableDependencies.length > 0) {
    throw new Error(
      `Buildable libraries can only depend on other buildable libraries. You must define the ${
        context.targetName
      } target for the following libraries: ${nonBuildableDependencies
        .map((t) => `"${t}"`)
        .join(', ')}`
    );
  }

  if (dependencies.length > 0) {
    const areDependentProjectsBuilt = checkDependentProjectsHaveBeenBuilt(
      context.root,
      context.projectName,
      context.targetName,
      dependencies
    );
    if (!areDependentProjectsBuilt) {
      throw new Error(
        `Some dependencies of '${context.projectName}' have not been built. This probably due to the ${context.targetName} target being misconfigured.`
      );
    }
    return {
      tmpTsConfig: createTmpTsConfig(
        join(context.root, tsConfigPath),
        context.root,
        projectRoot,
        dependencies
      ),
      projectRoot,
    };
  }

  return {
    tmpTsConfig: null,
    projectRoot,
  };
}
