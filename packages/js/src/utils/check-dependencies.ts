import { ExecutorContext, ProjectGraphProjectNode } from '@nx/devkit';
import {
  calculateProjectDependencies,
  createTmpTsConfig,
  DependentBuildableProjectNode,
} from './buildable-libs-utils';

export function checkDependencies(
  context: ExecutorContext,
  tsConfigPath: string
): {
  tmpTsConfig: string | null;
  projectRoot: string;
  target: ProjectGraphProjectNode;
  dependencies: DependentBuildableProjectNode[];
} {
  const { target, dependencies } = calculateProjectDependencies(
    context.projectGraph,
    context.root,
    context.projectName,
    context.targetName,
    context.configurationName
  );
  const projectRoot = target.data.root;

  if (dependencies.length > 0) {
    return {
      tmpTsConfig: createTmpTsConfig(
        tsConfigPath,
        context.root,
        projectRoot,
        dependencies
      ),
      projectRoot,
      target,
      dependencies,
    };
  }

  return {
    tmpTsConfig: null,
    projectRoot,
    target,
    dependencies,
  };
}
