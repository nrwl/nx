export interface ScopeData {
  bugCount: number;
  count: number;
  closed: number;
}

export interface ReportData {
  scopes: Record<string, ScopeData>;
  totalBugCount: number;
  totalIssueCount: number;
  totalClosed: number;
  untriagedIssueCount: number;
  collectedDate?: string;
}

export type TrendData = Omit<ReportData, 'collectedDate'>;
