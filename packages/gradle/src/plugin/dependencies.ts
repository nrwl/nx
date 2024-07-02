import {
  CreateDependencies,
  CreateDependenciesContext,
  DependencyType,
  FileMap,
  RawProjectGraphDependency,
  validateDependency,
} from '@nx/devkit';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

import {
  GRADLE_BUILD_FILES,
  getCurrentGradleReport,
  newLineSeparator,
} from '../utils/get-gradle-report';

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
    gradleProjectToProjectName,
    buildFileToDepsMap,
  } = getCurrentGradleReport();
  const dependencies: Set<RawProjectGraphDependency> = new Set();

  for (const gradleFile of gradleFiles) {
    const gradleProject = gradleFileToGradleProjectMap.get(gradleFile);
    const projectName = gradleProjectToProjectName.get(gradleProject);
    const depsFile = buildFileToDepsMap.get(gradleFile);

    if (projectName && depsFile) {
      processGradleDependencies(
        depsFile,
        gradleProjectToProjectName,
        projectName,
        gradleFile,
        context,
        dependencies
      );
    }
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
      if (GRADLE_BUILD_FILES.includes(basename(file.file))) {
        gradleFiles.push(file.file);
      }
    }
  }

  return gradleFiles;
}

export function processGradleDependencies(
  depsFile: string,
  gradleProjectToProjectName: Map<string, string>,
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
        const target = gradleProjectToProjectName.get(
          gradleProjectName
        ) as string;
        if (target) {
          const dependency: RawProjectGraphDependency = {
            source: sourceProjectName,
            target,
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
