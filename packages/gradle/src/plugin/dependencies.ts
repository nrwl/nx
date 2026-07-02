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
import { globWithWorkspaceContext } from 'nx/src/utils/workspace-context';
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

  // Report paths are workspace-relative since dev.nx.gradle.project-graph
  // 0.1.24; older versions emit absolute paths.
  const toWorkspaceRelative = (path: string) =>
    normalizePath(isAbsolute(path) ? relative(workspaceRoot, path) : path) ||
    '.';

  const dependencies: Array<StaticDependency> = [];
  dependenciesFromReport.forEach((dependencyFromPlugin: StaticDependency) => {
    try {
      const source = toWorkspaceRelative(dependencyFromPlugin.source);
      const sourceProjectName =
        Object.values(context.projects).find(
          (project) => source === project.root
        )?.name ?? dependencyFromPlugin.source;
      const target = toWorkspaceRelative(dependencyFromPlugin.target);
      const targetProjectName =
        Object.values(context.projects).find(
          (project) => target === project.root
        )?.name ?? dependencyFromPlugin.target;
      const sourceFile = toWorkspaceRelative(dependencyFromPlugin.sourceFile);
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
