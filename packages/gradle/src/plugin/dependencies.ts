import {
  CreateDependencies,
  CreateDependenciesContext,
  DependencyType,
  logger,
  normalizePath,
  StaticDependency,
  validateDependency,
  workspaceRoot,
} from '@nx/devkit';
import { relative } from 'node:path';

import {
  getCurrentProjectGraphReport,
  populateProjectGraph,
} from './utils/get-project-graph-from-gradle-plugin';
import { GradlePluginOptions } from './utils/gradle-plugin-options';
import { GRALDEW_FILES, splitConfigFiles } from '../utils/split-config-files';
import { globWithWorkspaceContext } from 'nx/src/utils/workspace-context';

export const createDependencies: CreateDependencies<
  GradlePluginOptions
> = async (
  options: GradlePluginOptions,
  context: CreateDependenciesContext
) => {
  const files = await globWithWorkspaceContext(
    workspaceRoot,
    Array.from(GRALDEW_FILES)
  );
  const { gradlewFiles } = splitConfigFiles(files);
  await populateProjectGraph(context.workspaceRoot, gradlewFiles, options);
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
        sourceFile: normalizePath(
          relative(workspaceRoot, dependencyFromPlugin.sourceFile)
        ),
      };
      validateDependency(dependency, context);
      dependencies.push(dependency);
    } catch {
      logger.warn(
        `Unable to parse dependency from gradle plugin: ${dependencyFromPlugin.source} -> ${dependencyFromPlugin.target}`
      );
    }
  });

  return dependencies;
};
