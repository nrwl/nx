import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import {
  AggregateCreateNodesError,
  logger,
  normalizePath,
  workspaceRoot,
} from '@nx/devkit';
import { combineGlobPatterns } from 'nx/src/utils/globs';

import { execGradleAsync } from './exec-gradle';
import { hashWithWorkspaceContext } from 'nx/src/utils/workspace-context';

export const fileSeparator = process.platform.startsWith('win')
  ? 'file:///'
  : 'file://';

export const newLineSeparator = process.platform.startsWith('win')
  ? '\r\n'
  : '\n';

export interface GradleReport {
  gradleFileToGradleProjectMap: Map<string, string>;
  buildFileToDepsMap: Map<string, string>;
  gradleFileToOutputDirsMap: Map<string, Map<string, string>>;
  gradleProjectToTasksTypeMap: Map<string, Map<string, string>>;
  gradleProjectToProjectName: Map<string, string>;
}

let gradleReportCache: GradleReport;
let gradleCurrentConfigHash: string;

export const GRADLE_BUILD_FILES = ['build.gradle', 'build.gradle.kts'];
export const GRADLE_TEST_FILES = [
  '**/src/test/java/**/*.java',
  '**/src/test/kotlin/**/*.kt',
];

export const gradleConfigGlob = combineGlobPatterns(
  ...GRADLE_BUILD_FILES.map((file) => `**/${file}`)
);

export function getCurrentGradleReport() {
  if (!gradleReportCache) {
    throw new Error(
      'Expected cached gradle report. Please open an issue at https://github.com/nrwl/nx/issues/new/choose'
    );
  }
  return gradleReportCache;
}

export async function populateGradleReport(
  workspaceRoot: string
): Promise<void> {
  const gradleConfigHash = await hashWithWorkspaceContext(workspaceRoot, [
    gradleConfigGlob,
  ]);
  if (gradleReportCache && gradleConfigHash === gradleCurrentConfigHash) {
    return;
  }

  const gradleProjectReportStart = performance.mark(
    'gradleProjectReport:start'
  );
  let projectReportLines;
  try {
    projectReportLines = await execGradleAsync(['projectReportAll'], {
      cwd: workspaceRoot,
    });
  } catch (e) {
    try {
      projectReportLines = await execGradleAsync(['projectReport'], {
        cwd: workspaceRoot,
      });
      logger.warn(
        'Could not run `projectReportAll` task. Ran `projectReport` instead. Please run `nx generate @nx/gradle:init` to generate the necessary tasks.'
      );
    } catch (e) {
      throw new AggregateCreateNodesError(
        [
          [
            null,
            new Error(
              'Could not run `projectReportAll` or `projectReport` task. Please run `nx generate @nx/gradle:init` to generate the necessary tasks.'
            ),
          ],
        ],
        []
      );
    }
  }
  projectReportLines = projectReportLines
    .toString()
    .split(newLineSeparator)
    .filter((line) => line.trim() !== '');

  const gradleProjectReportEnd = performance.mark('gradleProjectReport:end');
  performance.measure(
    'gradleProjectReport',
    gradleProjectReportStart.name,
    gradleProjectReportEnd.name
  );
  gradleReportCache = processProjectReports(projectReportLines);
}

export function processProjectReports(
  projectReportLines: string[]
): GradleReport {
  /**
   * Map of Gradle File path to Gradle Project Name
   */
  const gradleFileToGradleProjectMap = new Map<string, string>();
  const dependenciesMap = new Map<string, string>();
  /**
   * Map of Gradle Build File to tasks type map
   */
  const gradleProjectToTasksTypeMap = new Map<string, Map<string, string>>();
  const gradleProjectToProjectName = new Map<string, string>();
  /**
   * Map of buildFile to dependencies report path
   */
  const buildFileToDepsMap = new Map<string, string>();
  /**
   * Map fo possible output files of each gradle file
   * e.g. {build.gradle.kts: { projectReportDir: '' testReportDir: '' }}
   */
  const gradleFileToOutputDirsMap = new Map<string, Map<string, string>>();

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
        dependenciesMap.set(gradleProject, file);
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
          if (line.includes('Dir: ')) {
            const [dirName, dirPath] = line.split(': ');
            const taskName = dirName.replace('Dir', '');
            outputDirMap.set(
              taskName,
              `{workspaceRoot}/${relative(workspaceRoot, dirPath)}`
            );
          }
        }

        if (!projectName || !absBuildFilePath || !absBuildDirPath) {
          continue;
        }
        const buildFile = normalizePath(
          relative(workspaceRoot, absBuildFilePath)
        );
        const buildDir = relative(workspaceRoot, absBuildDirPath);
        buildFileToDepsMap.set(
          buildFile,
          dependenciesMap.get(gradleProject) as string
        );

        outputDirMap.set('build', `{workspaceRoot}/${buildDir}`);
        outputDirMap.set(
          'classes',
          `{workspaceRoot}/${join(buildDir, 'classes')}`
        );

        gradleFileToOutputDirsMap.set(buildFile, outputDirMap);
        gradleFileToGradleProjectMap.set(buildFile, gradleProject);
        gradleProjectToProjectName.set(gradleProject, projectName);
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
              while (tasksFileLines[++i] !== '') {
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
    buildFileToDepsMap,
    gradleFileToOutputDirsMap,
    gradleProjectToTasksTypeMap,
    gradleProjectToProjectName,
  };
}
