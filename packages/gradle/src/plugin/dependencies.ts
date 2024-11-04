import {
  CreateDependencies,
  CreateDependenciesContext,
  DependencyType,
  FileMap,
  RawProjectGraphDependency,
  validateDependency,
} from '@nx/devkit';
import { readFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';

import { getCurrentGradleReport } from '../utils/get-gradle-report';
import { GRADLE_BUILD_FILES } from '../utils/split-config-files';
import { newLineSeparator } from '../utils/get-project-report-lines';

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
    buildFileToDepsMap,
    gradleProjectToChildProjects,
  } = getCurrentGradleReport();
  const dependencies: Set<RawProjectGraphDependency> = new Set();

  for (const gradleFile of gradleFiles) {
    const gradleProject = gradleFileToGradleProjectMap.get(gradleFile);
    const projectName = Object.values(context.projects).find(
      (project) => project.root === dirname(gradleFile)
    )?.name;
    const depsFile = buildFileToDepsMap.get(gradleFile);

    if (projectName && depsFile) {
      processGradleDependencies(
        depsFile,
        gradleProjectNameToProjectRootMap,
        projectName,
        gradleFile,
        context,
        dependencies
      );
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

export function processGradleDependencies(
  depsFile: string,
  gradleProjectNameToProjectRoot: Map<string, string>,
  sourceProjectName: string,
  gradleFile: string,
  context: CreateDependenciesContext,
  dependencies: Set<RawProjectGraphDependency>
): void {
  const lines = readFileSync(depsFile).toString().split(newLineSeparator);
  let inDeps = false;
  for (const line of lines) {
    if (
      line.startsWith('implementationDependenciesMetadata') ||
      line.startsWith('compileClasspath')
    ) {
      inDeps = true;
      continue;
    }

    if (inDeps) {
      if (line === '') {
        inDeps = false;
        continue;
      }
      const [indents, dep] = line.split('--- ');
      if (indents === '\\' || indents === '+') {
        let gradleProjectName: string | undefined;
        if (dep.startsWith('project ')) {
          gradleProjectName = dep
            .substring('project '.length)
            .replace(/ \(n\)$/, '')
            .trim();
        } else if (dep.includes('-> project')) {
          const [_, projectName] = dep.split('-> project');
          gradleProjectName = projectName.trim();
        }
        const targetProjectRoot = gradleProjectNameToProjectRoot.get(
          gradleProjectName
        ) as string;
        const targetProjectName = Object.values(context.projects).find(
          (project) => project.root === targetProjectRoot
        )?.name;
        if (targetProjectName) {
          const dependency: RawProjectGraphDependency = {
            source: sourceProjectName,
            target: targetProjectName,
            type: DependencyType.static,
            sourceFile: gradleFile,
          };
          validateDependency(dependency, context);
          dependencies.add(dependency);
        }
      }
    }
  }
}
