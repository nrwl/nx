import { ExecutorContext, ProjectGraphProjectNode } from '@nx/devkit';
import {
  calculateProjectBuildableDependencies,
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
  const { projectName, targetName } = context;
  if (!projectName || !targetName) {
    throw new Error('checkDependencies requires a project and target name.');
  }
  const { target, dependencies } = calculateProjectBuildableDependencies(
    context.taskGraph,
    context.projectGraph,
    context.root,
    projectName,
    targetName,
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
