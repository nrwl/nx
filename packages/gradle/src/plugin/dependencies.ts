import {
  CreateDependencies,
  CreateDependenciesContext,
  DependencyType,
  StaticDependency,
  validateDependency,
  workspaceRoot,
} from '@nx/devkit';
import { relative } from 'node:path';

import { getCurrentProjectGraphReport } from './utils/get-project-graph-from-gradle-plugin';

export const createDependencies: CreateDependencies = async (
  _,
  context: CreateDependenciesContext
) => {
  const { dependencies: dependenciesFromReport } =
    getCurrentProjectGraphReport();

  const dependencies: Array<StaticDependency> = [];
  dependenciesFromReport.forEach((dependencyFromPlugin: StaticDependency) => {
    try {
      const source =
        relative(workspaceRoot, dependencyFromPlugin.source) || '.';
      const sourceProjectName =
        Object.values(context.projects).find(
          (project) => source === project.root
        )?.name ?? dependencyFromPlugin.source;
      const target =
        relative(workspaceRoot, dependencyFromPlugin.target) || '.';
      const targetProjectName =
        Object.values(context.projects).find(
          (project) => target === project.root
        )?.name ?? dependencyFromPlugin.target;
      if (!sourceProjectName || !targetProjectName) {
        return;
      }
      const dependency: StaticDependency = {
        source: sourceProjectName,
        target: targetProjectName,
        type: DependencyType.static,
        sourceFile: relative(workspaceRoot, dependencyFromPlugin.sourceFile),
      };
      validateDependency(dependency, context);
      dependencies.push(dependency);
    } catch {} // ignore invalid dependencies
  });

  return dependencies;
};
