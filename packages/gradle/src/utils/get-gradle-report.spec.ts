import { readFileSync } from 'fs';
import { join } from 'path';
import { processProjectReports } from './get-gradle-report';

describe('processProjectReports', () => {
  it('should process project reports', () => {
    const projectReportLines = readFileSync(
      join(__dirname, '__mocks__/gradle-project-report.txt'),
      'utf-8'
    ).split('\n');
    const report = processProjectReports(projectReportLines);
    expect(
      Object.keys(Object.fromEntries(report.gradleProjectToTasksTypeMap))
    ).toEqual(['', ':app', ':list', ':utilities']);
  });

  it('should process project reports with println', () => {
    const projectReportLines = readFileSync(
      join(__dirname, '__mocks__/gradle-project-report-println.txt'),
      'utf-8'
    ).split('\n');
    const report = processProjectReports(projectReportLines);
    expect(
      Object.keys(Object.fromEntries(report.gradleProjectToTasksTypeMap))
    ).toEqual(['', ':app', ':list', ':utilities']);
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
