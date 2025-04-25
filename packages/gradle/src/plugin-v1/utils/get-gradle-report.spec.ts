import { readFileSync } from 'fs';
import { fileSync } from 'tmp';
import { join } from 'path';
import {
  processGradleDependencies,
  processProjectReports,
  writeGradleReportToCache,
} from './get-gradle-report';

describe('processProjectReports', () => {
  const tmpFile = fileSync();

  it('should process project reports', () => {
    const projectReportLines = readFileSync(
      join(__dirname, '__mocks__/gradle-project-report.txt'),
      'utf-8'
    )
      .replaceAll('__dirname__', __dirname)
      .split('\n');
    const report = processProjectReports(projectReportLines);
    expect(
      Object.keys(Object.fromEntries(report.gradleProjectToTasksTypeMap))
    ).toEqual(['', ':app', ':list', ':utilities']);

    writeGradleReportToCache(tmpFile.name, report);
    expect(readFileSync(tmpFile.name).toString()).toMatchInlineSnapshot(`
      "{
        "gradleFileToGradleProjectMap": {},
        "gradleProjectToDepsMap": {
          "": [
            ":utilities"
          ],
          ":app": [
            ":utilities"
          ],
          ":list": [
            ":utilities"
          ],
          ":utilities": [
            ":utilities"
          ]
        },
        "gradleFileToOutputDirsMap": {},
        "gradleProjectToTasksTypeMap": {
          "": {},
          ":app": {},
          ":list": {},
          ":utilities": {}
        },
        "gradleProjectToTasksMap": {},
        "gradleProjectToProjectName": {},
        "gradleProjectNameToProjectRootMap": {},
        "gradleProjectToChildProjects": {}
      }"
    `);
  });

  it('should process project reports with println', () => {
    const projectReportLines = readFileSync(
      join(__dirname, '__mocks__/gradle-project-report-println.txt'),
      'utf-8'
    )
      .replaceAll('__dirname__', __dirname)
      .split('\n');
    const report = processProjectReports(projectReportLines);
    expect(
      Object.keys(Object.fromEntries(report.gradleProjectToTasksTypeMap))
    ).toEqual(['', ':app', ':list', ':utilities']);

    writeGradleReportToCache(tmpFile.name, report);
    expect(readFileSync(tmpFile.name).toString()).toMatchInlineSnapshot(`
      "{
        "gradleFileToGradleProjectMap": {},
        "gradleProjectToDepsMap": {
          "": [
            ":utilities"
          ],
          ":app": [
            ":utilities"
          ],
          ":list": [
            ":utilities"
          ],
          ":utilities": [
            ":utilities"
          ]
        },
        "gradleFileToOutputDirsMap": {},
        "gradleProjectToTasksTypeMap": {
          "": {},
          ":app": {},
          ":list": {},
          ":utilities": {}
        },
        "gradleProjectToTasksMap": {},
        "gradleProjectToProjectName": {},
        "gradleProjectNameToProjectRootMap": {},
        "gradleProjectToChildProjects": {}
      }"
    `);
  });

  it('should process properties report with child projects', () => {
    const report = processProjectReports([
      '> Task :propertyReport',
      `See the report at: file://${__dirname}/__mocks__/gradle-properties-report-child-projects.txt`,
    ]);
    expect(report.gradleProjectToProjectName.get('')).toEqual('My Application');
    expect(report.gradleProjectToChildProjects.get('')).toEqual([
      'app',
      'mylibrary',
    ]);
  });

  it('should process properties report for projects without child projects', () => {
    const report = processProjectReports([
      '> Task :propertyReport',
      `See the report at: file://${__dirname}/__mocks__/gradle-properties-report-no-child-projects.txt`,
    ]);
    expect(report.gradleProjectToProjectName.get('')).toEqual('app');
    expect(report.gradleProjectToChildProjects.get('')).toEqual([]);
  });
});

describe('processGradleDependencies', () => {
  it('should process gradle dependencies with composite build', () => {
    const depFilePath = join(
      __dirname,
      '..',
      'utils/__mocks__/gradle-composite-dependencies.txt'
    );
    const dependencies = processGradleDependencies(depFilePath);
    expect(Array.from(dependencies)).toEqual([
      ':my-utils:number-utils',
      ':my-utils:string-utils',
    ]);
  });

  it('should process gradle dependencies with regular build', () => {
    const depFilePath = join(
      __dirname,
      '..',
      'utils/__mocks__/gradle-dependencies.txt'
    );
    const dependencies = processGradleDependencies(depFilePath);
    expect(Array.from(dependencies)).toEqual([':utilities']);
  });

  it('should process gradle custom dependencies', () => {
    const depFilePath = join(
      __dirname,
      '..',
      'utils/__mocks__/gradle-custom-dependencies.txt'
    );
    const dependencies = processGradleDependencies(depFilePath);
    expect(Array.from(dependencies)).toEqual([
      ':spring-boot-project:spring-boot-parent',
      ':spring-boot-project:spring-boot-actuator',
      ':spring-boot-project:spring-boot-actuator-autoconfigure',
      ':spring-boot-project:spring-boot-autoconfigure',
      ':spring-boot-project:spring-boot-docker-compose',
      ':spring-boot-project:spring-boot-tools:spring-boot-cli',
      ':spring-boot-project:spring-boot-tools:spring-boot-loader-tools',
      ':spring-boot-project:spring-boot-test',
      ':spring-boot-project:spring-boot-test-autoconfigure',
      ':spring-boot-project:spring-boot-testcontainers',
      ':spring-boot-project:spring-boot-devtools',
    ]);
  });
});
