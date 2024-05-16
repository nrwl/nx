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
  getGradleReport,
  invalidateGradleReportCache,
} from '../utils/get-gradle-report';
import { calculatedTargets, writeTargetsToCache } from './nodes';

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
    gradleProjectToCompositeProjectsMap,
    gradleProjectNameToSettingsFileMap,
  } = getGradleReport();
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

  processCompsiteBuildDependencies(
    gradleProjectToCompositeProjectsMap,
    gradleProjectToProjectName,
    gradleProjectNameToSettingsFileMap,
    context,
    dependencies
  );

  const gradleDependenciesEnd = performance.mark('gradleDependencies:end');
  performance.measure(
    'gradleDependencies',
    gradleDependenciesStart.name,
    gradleDependenciesEnd.name
  );

  writeTargetsToCache(calculatedTargets);
  if (dependencies.size > 0) {
    invalidateGradleReportCache();
  }
  return Array.from(dependencies);
};

const gradleConfigFileNames = new Set(['build.gradle', 'build.gradle.kts']);

function findGradleFiles(fileMap: FileMap): string[] {
  const gradleFiles: string[] = [];

  for (const [_, files] of Object.entries(fileMap.projectFileMap)) {
    for (const file of files) {
      if (gradleConfigFileNames.has(basename(file.file))) {
        gradleFiles.push(file.file);
      }
    }
  }

  return gradleFiles;
}

function processGradleDependencies(
  depsFile: string,
  gradleProjectToProjectName: Map<string, string>,
  sourceProjectName: string,
  gradleFile: string,
  context: CreateDependenciesContext,
  dependencies: Set<RawProjectGraphDependency> = new Set()
): Set<RawProjectGraphDependency> {
  const lines = readFileSync(depsFile).toString().split('\n');
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
      if ((indents === '\\' || indents === '+') && dep.startsWith('project ')) {
        const gradleProjectName = dep
          .substring('project '.length)
          .replace(/ \(n\)$/, '')
          .trim();
        const target = gradleProjectToProjectName.get(
          gradleProjectName
        ) as string;
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
  return dependencies;
}

export function processCompsiteBuildDependencies(
  gradleProjectToCompositeProjectsMap: Map<string, string[]>,
  gradleProjectToProjectName: Map<string, string>,
  gradleProjectToSettingFileMap: Map<string, string>,
  context: CreateDependenciesContext,
  dependencies: Set<RawProjectGraphDependency> = new Set()
) {
  const rootProjects = gradleProjectToCompositeProjectsMap.keys();
  const projectNames = Array.from(gradleProjectToProjectName.values());
  for (const rootProject of rootProjects) {
    if (!projectNames.includes(rootProject)) {
      continue;
    }
    const subProjects = new Set<string>();
    getSubprojects(
      gradleProjectToCompositeProjectsMap,
      projectNames,
      rootProject,
      subProjects
    );
    subProjects.forEach((subProject) => {
      const dependency: RawProjectGraphDependency = {
        source: rootProject,
        target: subProject,
        type: DependencyType.static,
        sourceFile: gradleProjectToSettingFileMap.get(rootProject),
      };
      validateDependency(dependency, context);
      dependencies.add(dependency);
    });
  }
}

export function getSubprojects(
  gradleProjectToCompositeProjectsMap: Map<string, string[]>,
  projectNames: string[],
  rootProject: string,
  subProjects: Set<string>
) {
  const includedBuildProjects =
    gradleProjectToCompositeProjectsMap.get(rootProject) ?? [];
  includedBuildProjects.forEach((includedBuildProject) => {
    if (projectNames.includes(includedBuildProject)) {
      subProjects.add(includedBuildProject);
    } else {
      getSubprojects(
        gradleProjectToCompositeProjectsMap,
        projectNames,
        includedBuildProject,
        subProjects
      );
    }
  });
}
