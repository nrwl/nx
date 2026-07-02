import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';

import { writeJsonFile } from '@nx/devkit';

import {
  normalizeProjectGraphReport,
  normalizeReportPath,
  processNxProjectGraph,
  ProjectGraphReport,
} from './get-project-graph-from-gradle-plugin';

describe('normalizeReportPath', () => {
  const workspaceRoot = join(sep, 'ws');

  it('should keep relative paths and normalize separators', () => {
    expect(normalizeReportPath('apps/app', workspaceRoot)).toBe('apps/app');
    expect(normalizeReportPath('apps\\app', workspaceRoot)).toBe('apps/app');
  });

  it('should map the workspace root itself to .', () => {
    expect(normalizeReportPath(workspaceRoot, workspaceRoot)).toBe('.');
  });

  it('should relativize absolute paths under the workspace root', () => {
    expect(
      normalizeReportPath(join(workspaceRoot, 'apps', 'app'), workspaceRoot)
    ).toBe('apps/app');
  });

  it('should keep absolute paths outside the workspace root', () => {
    const outside = join(sep, 'other', 'app');
    expect(normalizeReportPath(outside, workspaceRoot)).toBe(outside);
  });
});

describe('normalizeProjectGraphReport', () => {
  const workspaceRoot = join(sep, 'ws');

  it('should relativize node keys and dependency paths', () => {
    const report: ProjectGraphReport = {
      nodes: {
        [join(workspaceRoot, 'apps', 'app')]: { name: ':app' },
        'libs/lib': { name: ':lib' },
      },
      dependencies: [
        {
          source: join(workspaceRoot, 'apps', 'app'),
          target: join(workspaceRoot, 'libs', 'lib'),
          sourceFile: join(workspaceRoot, 'apps', 'app', 'build.gradle'),
        } as any,
      ],
      externalNodes: {},
    };

    const normalized = normalizeProjectGraphReport(report, workspaceRoot);

    expect(Object.keys(normalized.nodes)).toEqual(['apps/app', 'libs/lib']);
    expect(normalized.dependencies).toEqual([
      {
        source: 'apps/app',
        target: 'libs/lib',
        sourceFile: 'apps/app/build.gradle',
      },
    ]);
  });
});

describe('processNxProjectGraph', () => {
  let reportDir: string;

  beforeAll(() => {
    reportDir = mkdtempSync(join(tmpdir(), 'gradle-report-'));
  });

  afterAll(() => {
    rmSync(reportDir, { recursive: true, force: true });
  });

  function writeReport(name: string, report: Partial<ProjectGraphReport>) {
    const file = join(reportDir, `${name}.json`);
    writeJsonFile(file, report);
    return file;
  }

  it('should ingest the report file printed after a task line', () => {
    const file = writeReport('app', {
      nodes: { 'apps/app': { name: ':app' } },
      dependencies: [],
      buildFiles: ['apps/app/build.gradle'],
    });

    const report = processNxProjectGraph(['> Task :app:nxProjectGraph', file]);

    expect(Object.keys(report.nodes)).toEqual(['apps/app']);
    expect(report.buildFiles).toEqual(['apps/app/build.gradle']);
  });

  it('should not consume another task report when a task printed no path', () => {
    const fileB = writeReport('b', {
      nodes: { 'libs/b': { name: ':b' } },
      dependencies: [],
    });

    const report = processNxProjectGraph([
      '> Task :a:nxProjectGraph',
      '> Task :b:nxProjectGraph',
      fileB,
    ]);

    expect(Object.keys(report.nodes)).toEqual(['libs/b']);
  });

  it('should handle output ending right after a task line', () => {
    const report = processNxProjectGraph(['> Task :a:nxProjectGraph']);

    expect(report.nodes).toEqual({});
  });

  it('should skip task lines with outcome suffixes', () => {
    const report = processNxProjectGraph([
      '> Task :a:nxProjectGraph UP-TO-DATE',
      '> Task :b:nxProjectGraph FROM-CACHE',
    ]);

    expect(report.nodes).toEqual({});
  });
});
