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

  const dependencies: Array<StaticDependency | ImplicitDependency> = [];
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
      // An ancestor-configured project's build file lies outside it, and Nx rejects a foreign
      // sourceFile — record implicit rather than drop.
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
