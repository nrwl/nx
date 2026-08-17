import {
  CreateDependencies,
  CreateDependenciesContext,
  DependencyType,
  ImplicitDependency,
  logger,
  normalizePath,
  StaticDependency,
  validateDependency,
  workspaceRoot,
} from '@nx/devkit';
import { dirname, isAbsolute, join, relative } from 'node:path';

import {
  getCurrentProjectGraphReport,
  populateProjectGraph,
} from './utils/get-project-graph-from-gradle-plugin';
import { GradlePluginOptions } from './utils/gradle-plugin-options';
import { GRADLEW_FILES, splitConfigFiles } from '../utils/split-config-files';
import { existsSync } from 'node:fs';
import { globWithWorkspaceContext } from '@nx/devkit/internal';

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
      const sourceProject = Object.values(context.projects).find(
        (project) => dependencyFromPlugin.source === project.root
      );
      const sourceProjectName =
        sourceProject?.name ?? dependencyFromPlugin.source;
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
      // A project configured from an ancestor build file (`project(':core') { }`) is attributed to
      // that ancestor, which lives outside the project. Nx only accepts a sourceFile that belongs
      // to the source project, so such an edge is recorded as implicit rather than dropped.
      const ownsSourceFile =
        !!sourceProject && dirname(sourceFile) === sourceProject.root;
      const dependency: StaticDependency | ImplicitDependency = ownsSourceFile
        ? {
            source: sourceProjectName,
            target: targetProjectName,
            type: DependencyType.static,
            sourceFile,
          }
        : {
            source: sourceProjectName,
            target: targetProjectName,
            type: DependencyType.implicit,
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
