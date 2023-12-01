import {
  CreateDependenciesContext,
  DependencyType,
  RawProjectGraphDependency,
  validateDependency,
} from '@nx/devkit';
import { requireNx } from '@nx/devkit/nx';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

import { getGradleReport } from '../utils/get-gradle-report';

const {
  createProjectRootMappingsFromProjectConfigurations,
  findProjectForPath,
} = requireNx();

export const createDependencies = async (
  _,
  context: CreateDependenciesContext
) => {
  const { filesToProcess, projects } = context;

  const gradleFiles = findGradleFiles(filesToProcess);

  if (gradleFiles.length === 0) {
    return [];
  }

  const projectRootMappings =
    createProjectRootMappingsFromProjectConfigurations(projects);
  let dependencies: RawProjectGraphDependency[] = [];
  console.time('locating gradle dependencies');
  const { gradleFileToGradleProjectMap, buildFileToDepsMap } =
    getGradleReport();
  /**
   * Map of gradle project name to nx project name
   */
  const gradleProjectToNxProjectMap = new Map<string, string>();
  for (const [buildFile, gradleProject] of gradleFileToGradleProjectMap) {
    const nxProject = findProjectForPath(buildFile, projectRootMappings);
    gradleProjectToNxProjectMap.set(gradleProject, nxProject as string);
  }

  for (const [source, gradleFile] of gradleFiles) {
    const depsFile = buildFileToDepsMap.get(gradleFile) as string;

    if (depsFile) {
      dependencies = dependencies.concat(
        processGradleDependencies(
          depsFile,
          gradleProjectToNxProjectMap,
          source,
          gradleFile,
          context
        )
      );
    }
  }
  console.timeEnd('locating gradle dependencies');
  return dependencies;
};
const gradleConfigFileNames = new Set(['build.gradle', 'build.gradle.kts']);

function findGradleFiles(
  filesToProcess: CreateDependenciesContext['filesToProcess']
) {
  const gradleFiles: [string, string][] = [];

  for (const [source, files] of Object.entries(filesToProcess.projectFileMap)) {
    for (const file of files) {
      if (gradleConfigFileNames.has(basename(file.file))) {
        gradleFiles.push([source, file.file]);
      }
    }
  }
  return gradleFiles;
}
function processGradleDependencies(
  depsFile: string,
  gradleProjectToNxProjectMap: Map<string, string>,
  source: string,
  gradleFile: string,
  context: CreateDependenciesContext
) {
  const dependencies: RawProjectGraphDependency[] = [];
  const lines = readFileSync(depsFile).toString().split('\n');
  let inDeps = false;
  for (const line of lines) {
    if (line.startsWith('implementationDependenciesMetadata')) {
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
        const target = gradleProjectToNxProjectMap.get(
          gradleProjectName
        ) as string;
        const dependency: RawProjectGraphDependency = {
          source: source,
          target,
          type: DependencyType.static,
          sourceFile: gradleFile,
        };
        validateDependency(dependency, context);
        dependencies.push(dependency);
      }
    }
  }
  return dependencies;
}
