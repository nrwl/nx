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
import { isAbsolute, join, relative } from 'node:path';

import {
  getCurrentProjectGraphReport,
  populateProjectGraph,
} from './utils/get-project-graph-from-gradle-plugin';
import { GradlePluginOptions } from './utils/gradle-plugin-options';
import { GRADLEW_FILES, splitConfigFiles } from '../utils/split-config-files';
import { globWithWorkspaceContext } from '@nx/devkit/internal';
import { existsSync } from 'node:fs';

export const createDependencies: CreateDependencies<
  GradlePluginOptions
> = async (
  options: GradlePluginOptions,
  context: CreateDependenciesContext
) => {
  const files = await globWithWorkspaceContext(
    workspaceRoot,
    Array.from(GRADLEW_FILES)
  );
  const { gradlewFiles } = splitConfigFiles(files);
  await populateProjectGraph(
    context.workspaceRoot,
    gradlewFiles.map((file) => join(workspaceRoot, file)),
    options
  );
  const { dependencies: dependenciesFromReport } =
    getCurrentProjectGraphReport();

  const dependencies: Array<StaticDependency> = [];
  dependenciesFromReport.forEach((dependencyFromPlugin: StaticDependency) => {
    try {
      // Report paths are workspace-relative with `/` separators
      const sourceProjectName =
        Object.values(context.projects).find(
          (project) => dependencyFromPlugin.source === project.root
        )?.name ?? dependencyFromPlugin.source;
      const targetProjectName =
        Object.values(context.projects).find(
          (project) => dependencyFromPlugin.target === project.root
        )?.name ?? dependencyFromPlugin.target;
      const sourceFile = dependencyFromPlugin.sourceFile;
      if (
        !sourceProjectName ||
        !targetProjectName ||
        !existsSync(join(workspaceRoot, sourceFile))
      ) {
        return;
      }
      const dependency: StaticDependency = {
        source: sourceProjectName,
        target: targetProjectName,
        type: DependencyType.static,
        sourceFile,
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
