import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { workspaceRoot } from '@nx/devkit';

import { execGradle } from './exec-gradle';

let gradleReport: ReturnType<typeof processProjectReports>;
export function getGradleReport() {
  if (gradleReport) {
    return gradleReport;
  }
  console.time('executing gradle commands');
  const projectReportLines = execGradle(['projectReport'], {
    cwd: workspaceRoot,
  })
    .toString()
    .split('\n');
  console.timeEnd('executing gradle commands');
  gradleReport = processProjectReports(projectReportLines);
  return gradleReport;
}

function processProjectReports(projectReportLines: string[]) {
  /**
   * Map of Gradle File path to Gradle Project Name
   */
  const gradleFileToGradleProjectMap = new Map<string, string>();
  /**
   * Map of Gradle Project Name to Gradle File
   */
  const gradleProjectToGradleFileMap = new Map<string, string>();
  const dependenciesMap = new Map<string, string>();
  /**
   * Map of Gradle Build File to available tasks
   */
  const tasksMap = new Map<string, string[]>();
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
   * e.g. {build.gralde.kts: { projectReportDir: '' testReportDir: '' }}
   */
  const gradleFileToOutputDirsMap = new Map<string, Map<string, string>>();

  projectReportLines.forEach((line, index) => {
    if (line.startsWith('> Task ')) {
      const nextLine = projectReportLines[index + 1];
      if (line.endsWith(':dependencyReport')) {
        const gradleProject = line.substring(
          '> Task '.length,
          line.length - ':dependencyReport'.length
        );
        const [_, file] = nextLine.split('file://');
        dependenciesMap.set(gradleProject, file);
      }
      if (line.endsWith('propertyReport')) {
        const gradleProject = line.substring(
          '> Task '.length,
          line.length - ':propertyReport'.length
        );
        const [_, file] = nextLine.split('file://');
        const propertyReportLines = readFileSync(file).toString().split('\n');

        let projectName: string,
          absBuildFilePath: string,
          absBuildDirPath: string;
        const tasks: string[] = [];
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
          if (line.includes(': task ')) {
            const taskSegments = line.split(': task ');
            tasks.push(taskSegments[0]);
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
          return;
        }
        const buildFile = relative(workspaceRoot, absBuildFilePath);
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
        gradleProjectToGradleFileMap.set(gradleProject, buildFile);
        gradleProjectToProjectName.set(gradleProject, projectName);
        tasksMap.set(buildFile, tasks);
      }
      if (line.endsWith('taskReport')) {
        const gradleProject = line.substring(
          '> Task '.length,
          line.length - ':taskReport'.length
        );
        const [_, file] = nextLine.split('file://');
        const taskTypeMap = new Map<string, string>();
        const tasksFileLines = readFileSync(file).toString().split('\n');

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
  });

  return {
    gradleFileToGradleProjectMap,
    buildFileToDepsMap,
    gradleFileToOutputDirsMap,
    gradleProjectToTasksTypeMap,
    tasksMap,
    gradleProjectToProjectName,
  };
}
