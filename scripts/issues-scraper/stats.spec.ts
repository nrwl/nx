import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ReportData, ScrapedData } from './model';
import { average, buildReport, getTrendData, percentile } from './stats';

const now = new Date('2026-08-30T00:00:00Z');
const since = new Date('2026-08-23T00:00:00Z');
const daysAgo = (days: number) =>
  new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

describe('percentile', () => {
  it('uses nearest-rank so the result is always a real sample', () => {
    const values = Array.from({ length: 20 }, (_, i) => i + 1);
    assert.equal(percentile(values, 0.95), 19);
    assert.equal(percentile([5], 0.95), 5);
  });

  it('is 0 for an empty sample', () => {
    assert.equal(percentile([], 0.95), 0);
  });
});

describe('average', () => {
  it('rounds to whole days', () => {
    assert.equal(average([1, 2, 4]), 2);
    assert.equal(average([]), 0);
  });
});

describe('buildReport', () => {
  const data: ScrapedData = {
    openIssues: [
      { scopes: ['scope: core'], bug: true, createdAt: daysAgo(10) },
      {
        scopes: ['scope: core', 'scope: react'],
        bug: false,
        createdAt: daysAgo(30),
      },
      { scopes: [], bug: true, createdAt: daysAgo(2) },
    ],
    closedIssues: [
      { scopes: ['scope: core'], bug: false, createdAt: daysAgo(100) },
      { scopes: [], bug: false, createdAt: daysAgo(100) },
    ],
    openPrs: [
      { scopes: ['scope: core'], merged: false, createdAt: daysAgo(3) },
      { scopes: [], merged: false, createdAt: daysAgo(40) },
    ],
    closedPrs: [
      { scopes: ['scope: core'], merged: true, createdAt: daysAgo(4) },
      { scopes: ['scope: react'], merged: false, createdAt: daysAgo(20) },
    ],
  };
  const report = buildReport(data, since, now);

  it('fills the Everything row from every item', () => {
    assert.deepEqual(report.all.issues, {
      count: 3,
      bugCount: 2,
      closed: 2,
      avgAge: 14,
      p95Age: 30,
    });
    assert.deepEqual(report.all.prs, {
      open: 2,
      created: 2,
      merged: 1,
      closed: 1,
      avgAge: 22,
      p95Age: 40,
    });
  });

  it('fills the Unscoped row from items with no scope label', () => {
    assert.deepEqual(report.unscoped.issues, {
      count: 1,
      bugCount: 1,
      closed: 1,
      avgAge: 2,
      p95Age: 2,
    });
    assert.deepEqual(report.unscoped.prs, {
      open: 1,
      created: 0,
      merged: 0,
      closed: 0,
      avgAge: 40,
      p95Age: 40,
    });
  });

  it('creates one row per scope label seen on any item', () => {
    assert.deepEqual(Object.keys(report.scopes).sort(), [
      'scope: core',
      'scope: react',
    ]);
    assert.deepEqual(report.scopes['scope: core'].issues, {
      count: 2,
      bugCount: 1,
      closed: 1,
      avgAge: 20,
      p95Age: 30,
    });
    assert.deepEqual(report.scopes['scope: core'].prs, {
      open: 1,
      created: 2,
      merged: 1,
      closed: 0,
      avgAge: 3,
      p95Age: 3,
    });
    assert.deepEqual(report.scopes['scope: react'].prs, {
      open: 0,
      created: 0,
      merged: 0,
      closed: 1,
      avgAge: 0,
      p95Age: 0,
    });
  });
});

describe('getTrendData', () => {
  const stats = (n: number) => ({
    issues: { count: n, bugCount: n, closed: n, avgAge: n, p95Age: n },
    prs: { open: n, created: n, merged: n, closed: n, avgAge: n, p95Age: n },
  });
  const current: ReportData = {
    all: stats(10),
    unscoped: stats(4),
    scopes: { 'scope: core': stats(6), 'scope: new': stats(2) },
  };

  it('subtracts the previous report field by field', () => {
    const prev: ReportData = {
      all: stats(7),
      unscoped: stats(5),
      scopes: { 'scope: core': stats(6) },
    };
    const trend = getTrendData(current, prev);
    assert.equal(trend.all.issues.count, 3);
    assert.equal(trend.all.prs.avgAge, 3);
    assert.equal(trend.unscoped.issues.bugCount, -1);
    assert.equal(trend.scopes['scope: core'].prs.merged, 0);
  });

  it('reports no delta when there is no previous row', () => {
    const trend = getTrendData(current, {});
    assert.equal(trend.all.issues.count, null);
    assert.equal(trend.all.issues.avgAge, null);
    assert.equal(trend.scopes['scope: new'].prs.open, null);
    assert.equal(trend.scopes['scope: new'].prs.p95Age, null);
  });
});
