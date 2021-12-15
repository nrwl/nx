import { ExecutorContext } from '@nrwl/devkit';
import { readCachedProjectGraph } from '@nrwl/workspace/src/core/project-graph';
import {
  calculateProjectDependencies,
  checkDependentProjectsHaveBeenBuilt,
  createTmpTsConfig,
  DependentBuildableProjectNode,
} from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import { join } from 'path';

export function checkDependencies(
  context: ExecutorContext,
  tsConfigPath: string
): {
  shouldContinue: boolean;
  tmpTsConfig: string | null;
  projectRoot: string;
  projectDependencies: DependentBuildableProjectNode[];
} {
  const projectGraph = readCachedProjectGraph();
  const { target, dependencies } = calculateProjectDependencies(
    projectGraph,
    context.root,
    context.projectName,
    context.targetName,
    context.configurationName
  );
  const projectRoot = target.data.root;

  if (dependencies.length > 0) {
    const areDependentProjectsBuilt = checkDependentProjectsHaveBeenBuilt(
      context.root,
      context.projectName,
      context.targetName,
      dependencies
    );
    return {
      shouldContinue: areDependentProjectsBuilt,
      tmpTsConfig:
        areDependentProjectsBuilt &&
        createTmpTsConfig(
          join(context.root, tsConfigPath),
          context.root,
          projectRoot,
          dependencies
        ),
      projectRoot,
      projectDependencies: dependencies,
    };
  }

  return {
    shouldContinue: true,
    tmpTsConfig: null,
    projectRoot,
    projectDependencies: dependencies,
  };
}
