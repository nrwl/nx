import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { writeJsonFile } from '@nx/devkit';

import {
  processNxProjectGraph,
  ProjectGraphReport,
} from './get-project-graph-from-gradle-plugin';

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
    writeJsonFile(file, { formatVersion: 1, ...report });
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

  it('should reject reports from plugin versions before 0.1.24', () => {
    const file = join(reportDir, 'old-format.json');
    writeJsonFile(file, {
      nodes: { '/some/machine/apps/app': { name: ':app' } },
      dependencies: [],
    });

    let error: any;
    try {
      processNxProjectGraph(['> Task :app:nxProjectGraph', file]);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.errors[0][1].message).toContain(
      'requires dev.nx.gradle.project-graph 0.1.24 or newer'
    );
  });
});
