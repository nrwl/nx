import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import {
  AggregateCreateNodesError,
  normalizePath,
  readJsonFile,
  workspaceRoot,
  writeJsonFile,
} from '@nx/devkit';

import { hashWithWorkspaceContext } from 'nx/src/utils/workspace-context';
import { dirname } from 'path';
import { gradleConfigAndTestGlob } from '../../utils/split-config-files';
import { getProjectReportLines } from './get-project-report-lines';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { fileSeparator, newLineSeparator } from '../../utils/exec-gradle';

export interface GradleReport {
  gradleFileToGradleProjectMap: Map<string, string>;
  gradleFileToOutputDirsMap: Map<string, Map<string, string>>;
  gradleProjectToDepsMap: Map<string, Set<string>>;
  gradleProjectToTasksTypeMap: Map<string, Map<string, string>>;
  gradleProjectToTasksMap: Map<string, Set<string>>;
  gradleProjectToProjectName: Map<string, string>;
  gradleProjectNameToProjectRootMap: Map<string, string>;
  gradleProjectToChildProjects: Map<string, string[]>;
}

export interface GradleReportJSON {
  hash: string;
  gradleFileToGradleProjectMap: Record<string, string>;
  gradleProjectToDepsMap: Record<string, Array<string>>;
  gradleFileToOutputDirsMap: Record<string, Record<string, string>>;
  gradleProjectToTasksTypeMap: Record<string, Record<string, string>>;
  gradleProjectToTasksMap: Record<string, Array<string>>;
  gradleProjectToProjectName: Record<string, string>;
  gradleProjectNameToProjectRootMap: Record<string, string>;
  gradleProjectToChildProjects: Record<string, string[]>;
}

function readGradleReportCache(
  cachePath: string,
  hash: string
): GradleReport | undefined {
  const gradleReportJson: Partial<GradleReportJSON> = existsSync(cachePath)
    ? readJsonFile(cachePath)
    : undefined;
  if (!gradleReportJson || gradleReportJson.hash !== hash) {
    return;
  }
  let results: GradleReport = {
    gradleFileToGradleProjectMap: new Map(
      Object.entries(gradleReportJson['gradleFileToGradleProjectMap'])
    ),
    gradleProjectToDepsMap: new Map(
      Object.entries(gradleReportJson['gradleProjectToDepsMap']).map(
        ([key, value]) => [key, new Set(value)]
      )
    ),
    gradleFileToOutputDirsMap: new Map(
      Object.entries(gradleReportJson['gradleFileToOutputDirsMap']).map(
        ([key, value]) => [key, new Map(Object.entries(value))]
      )
    ),
    gradleProjectToTasksTypeMap: new Map(
      Object.entries(gradleReportJson['gradleProjectToTasksTypeMap']).map(
        ([key, value]) => [key, new Map(Object.entries(value))]
      )
    ),
    gradleProjectToTasksMap: new Map(
      Object.entries(gradleReportJson['gradleProjectToTasksMap']).map(
        ([key, value]) => [key, new Set(value)]
      )
    ),
    gradleProjectToProjectName: new Map(
      Object.entries(gradleReportJson['gradleProjectToProjectName'])
    ),
    gradleProjectNameToProjectRootMap: new Map(
      Object.entries(gradleReportJson['gradleProjectNameToProjectRootMap'])
    ),
    gradleProjectToChildProjects: new Map(
      Object.entries(gradleReportJson['gradleProjectToChildProjects'])
    ),
  };
  return results;
}

export function writeGradleReportToCache(
  cachePath: string,
  results: GradleReport
) {
  let gradleReportJson: GradleReportJSON = {
    hash: gradleCurrentConfigHash,
    gradleFileToGradleProjectMap: Object.fromEntries(
      results.gradleFileToGradleProjectMap
    ),
    gradleProjectToDepsMap: Object.fromEntries(
      Array.from(results.gradleProjectToDepsMap).map(([key, value]) => [
        key,
        Array.from(value),
      ])
    ),
    gradleFileToOutputDirsMap: Object.fromEntries(
      Array.from(results.gradleFileToOutputDirsMap).map(([key, value]) => [
        key,
        Object.fromEntries(value),
      ])
    ),
    gradleProjectToTasksTypeMap: Object.fromEntries(
      Array.from(results.gradleProjectToTasksTypeMap).map(([key, value]) => [
        key,
        Object.fromEntries(value),
      ])
    ),
    gradleProjectToTasksMap: Object.fromEntries(
      Array.from(results.gradleProjectToTasksMap).map(([key, value]) => [
        key,
        Array.from(value),
      ])
    ),
    gradleProjectToProjectName: Object.fromEntries(
      results.gradleProjectToProjectName
    ),
    gradleProjectNameToProjectRootMap: Object.fromEntries(
      results.gradleProjectNameToProjectRootMap
    ),
    gradleProjectToChildProjects: Object.fromEntries(
      results.gradleProjectToChildProjects
    ),
  };

  writeJsonFile(cachePath, gradleReportJson);
}

let gradleReportCache: GradleReport;
let gradleCurrentConfigHash: string;
let gradleReportCachePath: string = join(
  workspaceDataDirectory,
  'gradle-report.hash'
);

export function getCurrentGradleReport() {
  if (!gradleReportCache) {
    throw new AggregateCreateNodesError(
      [
        [
          null,
          new Error(
            `Expected cached gradle report. Please open an issue at https://github.com/nrwl/nx/issues/new/choose`
          ),
        ],
      ],
      []
    );
  }
  return gradleReportCache;
}

/**
 * This function populates the gradle report cache.
 * For each gradlew file, it runs the `projectReportAll` task and processes the output.
 * If `projectReportAll` fails, it runs the `projectReport` task instead.
 * It will throw an error if both tasks fail.
 * It will accumulate the output of all gradlew files.
 * @param workspaceRoot
 * @param gradlewFiles absolute paths to all gradlew files in the workspace
 * @returns Promise<void>
 */
export async function populateGradleReport(
  workspaceRoot: string,
  gradlewFiles: string[]
): Promise<void> {
  const gradleConfigHash = await hashWithWorkspaceContext(workspaceRoot, [
    gradleConfigAndTestGlob,
  ]);
  gradleReportCache ??= readGradleReportCache(
    gradleReportCachePath,
    gradleConfigHash
  );
  if (
    gradleReportCache &&
    (!gradleCurrentConfigHash || gradleConfigHash === gradleCurrentConfigHash)
  ) {
    return;
  }

  const gradleProjectReportStart = performance.mark(
    'gradleProjectReport:start'
  );

  const projectReportLines = await gradlewFiles.reduce(
    async (
      projectReportLines: Promise<string[]>,
      gradlewFile: string
    ): Promise<string[]> => {
      const allLines = await projectReportLines;
      const currentLines = await getProjectReportLines(gradlewFile);
      return [...allLines, ...currentLines];
    },
    Promise.resolve([])
  );

  const gradleProjectReportEnd = performance.mark('gradleProjectReport:end');
  performance.measure(
    'gradleProjectReport',
    gradleProjectReportStart.name,
    gradleProjectReportEnd.name
  );
  gradleCurrentConfigHash = gradleConfigHash;
  gradleReportCache = processProjectReports(projectReportLines);
  writeGradleReportToCache(gradleReportCachePath, gradleReportCache);
}

export function processProjectReports(
  projectReportLines: string[]
): GradleReport {
  /**
   * Map of Gradle File path to Gradle Project Name
   */
  const gradleFileToGradleProjectMap = new Map<string, string>();
  const gradleProjectToDepsMap = new Map<string, Set<string>>();
  /**
   * Map of Gradle Build File to tasks type map
   */
  const gradleProjectToTasksTypeMap = new Map<string, Map<string, string>>();
  const gradleProjectToTasksMap = new Map<string, Set<string>>();
  const gradleProjectToProjectName = new Map<string, string>();
  const gradleProjectNameToProjectRootMap = new Map<string, string>();
  /**
   * Map fo possible output files of each gradle file
   * e.g. {build.gradle.kts: { projectReportDir: '' testReportDir: '' }}
   */
  const gradleFileToOutputDirsMap = new Map<string, Map<string, string>>();
  /**
   * Map of Gradle Project to its child projects
   */
  const gradleProjectToChildProjects = new Map<string, string[]>();

  let index = 0;
  while (index < projectReportLines.length) {
    const line = projectReportLines[index].trim();
    if (line.startsWith('> Task ')) {
      if (line.endsWith(':dependencyReport')) {
        const gradleProject = line.substring(
          '> Task '.length,
          line.length - ':dependencyReport'.length
        );
        while (
          index < projectReportLines.length &&
          !projectReportLines[index].includes(fileSeparator)
        ) {
          index++;
        }
        const [_, file] = projectReportLines[index].split(fileSeparator);
        gradleProjectToDepsMap.set(
          gradleProject,
          processGradleDependencies(file)
        );
      }
      if (line.endsWith('propertyReport')) {
        const gradleProject = line.substring(
          '> Task '.length,
          line.length - ':propertyReport'.length
        );
        while (
          index < projectReportLines.length &&
          !projectReportLines[index].includes(fileSeparator)
        ) {
          index++;
        }
        const [_, file] = projectReportLines[index].split(fileSeparator);
        const propertyReportLines = existsSync(file)
          ? readFileSync(file).toString().split(newLineSeparator)
          : [];

        let projectName: string,
          absBuildFilePath: string,
          absBuildDirPath: string;
        const outputDirMap = new Map<string, string>();
        const tasks = new Set<string>();
        for (const line of propertyReportLines) {
          if (line.startsWith('name: ')) {
            projectName = line.substring('name: '.length);
          }
          if (line.startsWith('buildFile: ')) {
            absBuildFilePath = line.substring('buildFile: '.length);
          }
          if (line.startsWith('buildDir: ')) {
            absBuildDirPath = line.substring('buildDir: '.length);
          }
          if (line.startsWith('childProjects: ')) {
            const childProjects = line.substring(
              'childProjects: {'.length,
              line.length - 1
            ); // remove curly braces {} around childProjects
            gradleProjectToChildProjects.set(
              gradleProject,
              childProjects
                .split(',')
                .map((c) => c.trim().split('=')[0])
                .filter(Boolean) // e.g. get project name from text like "app=project ':app', mylibrary=project ':mylibrary'"
            );
          }
          if (line.includes('Dir: ')) {
            const [dirName, dirPath] = line.split(': ');
            const taskName = dirName.replace('Dir', '');
            outputDirMap.set(
              taskName,
              `{workspaceRoot}/${relative(workspaceRoot, dirPath)}`
            );
          }
          if (line.includes(': task ')) {
            const [task] = line.split(': task ');
            tasks.add(task);
          }
        }

        if (!projectName || !absBuildFilePath || !absBuildDirPath) {
          continue;
        }
        const buildFile = normalizePath(
          relative(workspaceRoot, absBuildFilePath)
        );
        const buildDir = relative(workspaceRoot, absBuildDirPath);

        outputDirMap.set('build', `{workspaceRoot}/${buildDir}`);
        outputDirMap.set(
          'classes',
          `{workspaceRoot}/${join(buildDir, 'classes')}`
        );

        gradleFileToOutputDirsMap.set(buildFile, outputDirMap);
        gradleFileToGradleProjectMap.set(buildFile, gradleProject);
        gradleProjectToProjectName.set(gradleProject, projectName);
        gradleProjectNameToProjectRootMap.set(
          gradleProject,
          dirname(buildFile)
        );
        gradleProjectToTasksMap.set(gradleProject, tasks);
      }
      if (line.endsWith('taskReport')) {
        const gradleProject = line.substring(
          '> Task '.length,
          line.length - ':taskReport'.length
        );
        while (
          index < projectReportLines.length &&
          !projectReportLines[index].includes(fileSeparator)
        ) {
          index++;
        }
        const [_, file] = projectReportLines[index].split(fileSeparator);
        const taskTypeMap = new Map<string, string>();
        const tasksFileLines = existsSync(file)
          ? readFileSync(file).toString().split(newLineSeparator)
          : [];

        let i = 0;
        while (i < tasksFileLines.length) {
          const line = tasksFileLines[i];

          if (line.endsWith('tasks')) {
            const dashes = new Array(line.length + 1).join('-');
            if (tasksFileLines[i + 1] === dashes) {
              const type = line.substring(0, line.length - ' tasks'.length);
              i++;
              while (
                tasksFileLines[++i] !== '' &&
                i < tasksFileLines.length &&
                tasksFileLines[i]?.includes(' - ')
              ) {
                const [taskName] = tasksFileLines[i].split(' - ');
                taskTypeMap.set(taskName, type);
              }
            }
          }
          i++;
        }
        gradleProjectToTasksTypeMap.set(gradleProject, taskTypeMap);
      }
    }
    index++;
  }

  return {
    gradleFileToGradleProjectMap,
    gradleFileToOutputDirsMap,
    gradleProjectToTasksTypeMap,
    gradleProjectToDepsMap,
    gradleProjectToTasksMap,
    gradleProjectToProjectName,
    gradleProjectNameToProjectRootMap,
    gradleProjectToChildProjects,
  };
}

export function processGradleDependencies(depsFile: string): Set<string> {
  const dependedProjects = new Set<string>();
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
        let targetProjectName: string | undefined;
        if (dep.startsWith('project ')) {
          targetProjectName = dep
            .substring('project '.length)
            .replace(/ \(n\)$/, '')
            .trim()
            .split(' ')?.[0];
        } else if (dep.includes('-> project')) {
          const [_, projectName] = dep.split('-> project');
          targetProjectName = projectName.trim().split(' ')?.[0];
        }
        if (targetProjectName) {
          dependedProjects.add(targetProjectName);
        }
      }
    }
  }
  return dependedProjects;
}
