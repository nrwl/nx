export interface ScopeData {
  bugCount: number;
  count: number;
}

export interface ReportData {
  scopes: Record<string, ScopeData>;
  totalBugCount: number;
  totalIssueCount: number;
  untriagedIssueCount: number;
  collectedDate?: string;
}
