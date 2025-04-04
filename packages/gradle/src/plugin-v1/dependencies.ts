import {
  CreateDependencies,
  CreateDependenciesContext,
  DependencyType,
  FileMap,
  RawProjectGraphDependency,
  validateDependency,
} from '@nx/devkit';
import { basename, dirname } from 'node:path';

import { getCurrentGradleReport } from './utils/get-gradle-report';
import { GRADLE_BUILD_FILES } from '../utils/split-config-files';

export const createDependencies: CreateDependencies = async (
  _,
  context: CreateDependenciesContext
) => {
  const gradleFiles: string[] = findGradleFiles(context.filesToProcess);
  if (gradleFiles.length === 0) {
    return [];
  }

  const gradleDependenciesStart = performance.mark('gradleDependencies:start');
  const {
    gradleFileToGradleProjectMap,
    gradleProjectNameToProjectRootMap,
    gradleProjectToDepsMap,
    gradleProjectToChildProjects,
  } = getCurrentGradleReport();
  const dependencies: Set<RawProjectGraphDependency> = new Set();

  for (const gradleFile of gradleFiles) {
    const gradleProject = gradleFileToGradleProjectMap.get(gradleFile);
    const projectName = Object.values(context.projects).find(
      (project) => project.root === dirname(gradleFile)
    )?.name;
    const dependedProjects: Set<string> =
      gradleProjectToDepsMap.get(gradleProject);

    if (projectName && dependedProjects?.size) {
      dependedProjects?.forEach((dependedProject) => {
        const targetProjectRoot = gradleProjectNameToProjectRootMap.get(
          dependedProject
        ) as string;
        const targetProjectName = Object.values(context.projects).find(
          (project) => project.root === targetProjectRoot
        )?.name;
        if (targetProjectName) {
          const dependency: RawProjectGraphDependency = {
            source: projectName as string,
            target: targetProjectName as string,
            type: DependencyType.static,
            sourceFile: gradleFile,
          };
          validateDependency(dependency, context);
          dependencies.add(dependency);
        }
      });
    }
    gradleProjectToChildProjects.get(gradleProject)?.forEach((childProject) => {
      if (childProject) {
        const dependency: RawProjectGraphDependency = {
          source: projectName as string,
          target: childProject,
          type: DependencyType.static,
          sourceFile: gradleFile,
        };
        validateDependency(dependency, context);
        dependencies.add(dependency);
      }
    });
  }

  const gradleDependenciesEnd = performance.mark('gradleDependencies:end');
  performance.measure(
    'gradleDependencies',
    gradleDependenciesStart.name,
    gradleDependenciesEnd.name
  );

  return Array.from(dependencies);
};

function findGradleFiles(fileMap: FileMap): string[] {
  const gradleFiles: string[] = [];

  for (const [_, files] of Object.entries(fileMap.projectFileMap)) {
    for (const file of files) {
      if (GRADLE_BUILD_FILES.has(basename(file.file))) {
        gradleFiles.push(file.file);
      }
    }
  }

  return gradleFiles;
}
