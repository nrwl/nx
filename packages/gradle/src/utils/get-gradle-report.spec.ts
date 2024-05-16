import { readFileSync } from 'fs';
import { join } from 'path';
import { processProjectReports, processProjects } from './get-gradle-report';

describe('getGradleReport', () => {
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
  });

  describe('processProjects', () => {
    it('should process projects with included builds', () => {
      const projectReportLines = readFileSync(
        join(__dirname, '__mocks__/gradle-projects.txt'),
        'utf-8'
      ).split('\n');
      const report = processProjects(projectReportLines);
      expect(report).toEqual({
        compositeProjects: ['my-app', 'my-utils'],
        projectName: 'my-composite',
      });
    });

    it('should process projects with subprojects', () => {
      const projectReportLines = readFileSync(
        join(__dirname, '__mocks__/gradle-projects-sub-projects.txt'),
        'utf-8'
      ).split('\n');
      const report = processProjects(projectReportLines);
      expect(report).toEqual({
        compositeProjects: ['app'],
        projectName: 'my-app',
      });
    });
  });
});
