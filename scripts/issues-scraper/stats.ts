import {
  IssueStats,
  PrStats,
  ReportData,
  ScopeData,
  ScopeTrend,
  ScrapedData,
  ScrapedIssue,
  ScrapedItem,
  ScrapedPr,
  StatsTrend,
  TrendData,
} from './model';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
}

export function buildReport(
  data: ScrapedData,
  since: Date,
  now: Date
): ReportData {
  const scopeLabels = new Set<string>();
  for (const items of Object.values(data)) {
    for (const item of items) {
      item.scopes.forEach((s) => scopeLabels.add(s));
    }
  }

  const scopes: Record<string, ScopeData> = {};
  for (const scope of scopeLabels) {
    scopes[scope] = computeScopeData(
      filterData(data, (item) => item.scopes.includes(scope)),
      since,
      now
    );
  }

  return {
    all: computeScopeData(data, since, now),
    unscoped: computeScopeData(
      filterData(data, (item) => item.scopes.length === 0),
      since,
      now
    ),
    scopes,
  };
}

function filterData(
  data: ScrapedData,
  predicate: (item: ScrapedItem) => boolean
): ScrapedData {
  return {
    openIssues: data.openIssues.filter(predicate),
    closedIssues: data.closedIssues.filter(predicate),
    openPrs: data.openPrs.filter(predicate),
    closedPrs: data.closedPrs.filter(predicate),
  };
}

function computeScopeData(
  data: ScrapedData,
  since: Date,
  now: Date
): ScopeData {
  return {
    issues: computeIssueStats(data.openIssues, data.closedIssues, now),
    prs: computePrStats(data.openPrs, data.closedPrs, since, now),
  };
}

function computeIssueStats(
  open: ScrapedIssue[],
  closed: ScrapedIssue[],
  now: Date
): IssueStats {
  const ages = open.map((i) => ageInDays(i, now));
  return {
    count: open.length,
    bugCount: open.filter((i) => i.bug).length,
    closed: closed.length,
    avgAge: average(ages),
    p95Age: percentile(ages, 0.95),
  };
}

function computePrStats(
  open: ScrapedPr[],
  closed: ScrapedPr[],
  since: Date,
  now: Date
): PrStats {
  const ages = open.map((pr) => ageInDays(pr, now));
  const createdSince = (pr: ScrapedPr) => pr.createdAt >= since;
  return {
    open: open.length,
    created:
      open.filter(createdSince).length + closed.filter(createdSince).length,
    merged: closed.filter((pr) => pr.merged).length,
    closed: closed.filter((pr) => !pr.merged).length,
    avgAge: average(ages),
    p95Age: percentile(ages, 0.95),
  };
}

function ageInDays(item: ScrapedItem, now: Date): number {
  return Math.floor((now.getTime() - item.createdAt.getTime()) / MS_PER_DAY);
}

export function getTrendData(
  current: ReportData,
  previous: Partial<ReportData>
): TrendData {
  const scopes: Record<string, ScopeTrend> = {};
  for (const [scope, data] of Object.entries(current.scopes)) {
    scopes[scope] = scopeTrend(data, previous.scopes?.[scope]);
  }
  return {
    all: scopeTrend(current.all, previous.all),
    unscoped: scopeTrend(current.unscoped, previous.unscoped),
    scopes,
  };
}

function scopeTrend(current: ScopeData, previous?: ScopeData): ScopeTrend {
  return {
    issues: statsTrend(current.issues, previous?.issues),
    prs: statsTrend(current.prs, previous?.prs),
  };
}

function statsTrend<T extends Record<keyof T, number>>(
  current: T,
  previous?: T
): StatsTrend<T> {
  const trend = {} as StatsTrend<T>;
  for (const field of Object.keys(current) as (keyof T)[]) {
    const prev = previous?.[field];
    trend[field] = prev === undefined ? null : current[field] - prev;
  }
  return trend;
}
