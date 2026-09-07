export interface IssueStats {
  count: number;
  bugCount: number;
  closed: number;
  avgAge: number;
  p95Age: number;
}

export interface PrStats {
  open: number;
  created: number;
  merged: number;
  closed: number;
  avgAge: number;
  p95Age: number;
}

export interface ScopeData {
  issues: IssueStats;
  prs: PrStats;
}

export interface ReportData {
  all: ScopeData;
  unscoped: ScopeData;
  scopes: Record<string, ScopeData>;
  collectedDate?: string;
}

export type StatsTrend<T> = Record<keyof T, number | null>;

export interface ScopeTrend {
  issues: StatsTrend<IssueStats>;
  prs: StatsTrend<PrStats>;
}

export interface TrendData {
  all: ScopeTrend;
  unscoped: ScopeTrend;
  scopes: Record<string, ScopeTrend>;
}

export interface ScrapedItem {
  scopes: string[];
  createdAt: Date;
}

export interface ScrapedIssue extends ScrapedItem {
  bug: boolean;
}

export interface ScrapedPr extends ScrapedItem {
  merged: boolean;
}

export interface ScrapedData {
  openIssues: ScrapedIssue[];
  closedIssues: ScrapedIssue[];
  openPrs: ScrapedPr[];
  closedPrs: ScrapedPr[];
}
