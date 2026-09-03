import { Octokit } from 'octokit';
import { ReportData, ScrapedData, ScrapedIssue, ScrapedPr } from './model';
import { buildReport } from './stats';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const now = new Date();

export async function scrapeIssues(prevDate?: Date): Promise<ReportData> {
  const scopeLabels = await getScopeLabels();
  const sinceDate = getSinceDate(prevDate);

  const open: IssueItem[] = [];
  for await (const { data: slice } of getOpenIssueIterator()) {
    open.push(...slice);
  }
  const closed: IssueItem[] = [];
  for await (const { data: slice } of getClosedIssueIterator(sinceDate)) {
    closed.push(...slice);
  }

  return {
    ...buildReport(
      toScrapedData(open, closed, scopeLabels, sinceDate),
      sinceDate,
      now
    ),
    // Format is like: Mar 03 2023
    collectedDate: now.toDateString().split(' ').slice(1).join(' '),
  };
}

export function toScrapedData(
  open: IssueItem[],
  closed: IssueItem[],
  scopeLabels: string[],
  sinceDate: Date
): ScrapedData {
  const data: ScrapedData = {
    openIssues: [],
    closedIssues: [],
    openPrs: [],
    closedPrs: [],
  };
  for (const item of open) {
    if (isPullRequest(item)) {
      data.openPrs.push(toPr(item, scopeLabels));
    } else {
      data.openIssues.push(toIssue(item, scopeLabels));
    }
  }
  for (const item of closed) {
    if (!isPullRequest(item)) {
      data.closedIssues.push(toIssue(item, scopeLabels));
    } else if (prClosedAt(item) >= sinceDate) {
      data.closedPrs.push(toPr(item, scopeLabels));
    }
  }
  return data;
}

export function getSinceDate(prevDate?: Date, referenceDate = now): Date {
  const firstOfPrevMonth = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth() - 1,
    1
  );
  if (prevDate && prevDate > firstOfPrevMonth) {
    return prevDate;
  }
  return firstOfPrevMonth;
}

const getOpenIssueIterator = () =>
  octokit.paginate.iterator('GET /repos/{owner}/{repo}/issues', {
    owner: 'nrwl',
    repo: 'nx',
    per_page: 100,
    state: 'open',
  });

// `since` filters on updated_at, so closed PRs are re-checked against
// their merged_at / closed_at before being counted.
const getClosedIssueIterator = (since: Date) =>
  octokit.paginate.iterator('GET /repos/{owner}/{repo}/issues', {
    owner: 'nrwl',
    repo: 'nx',
    per_page: 100,
    state: 'closed',
    sort: 'updated',
    direction: 'desc',
    since: since.toISOString(),
  });

let labelCache: string[];
export async function getScopeLabels(): Promise<string[]> {
  labelCache ??= await getAllLabels().then((labels) =>
    labels.filter((l) => l.startsWith('scope:'))
  );
  return labelCache;
}

async function getAllLabels(): Promise<string[]> {
  const labels: string[] = [];

  for await (const { data: slice } of octokit.paginate.iterator(
    'GET /repos/{owner}/{repo}/labels',
    { owner: 'nrwl', repo: 'nx' }
  )) {
    labels.push(...slice.map((l) => l.name));
  }
  return labels;
}

export type IssueItem = Awaited<
  ReturnType<typeof octokit.rest.issues.listForRepo>
>['data'][number];

function isPullRequest(issue: IssueItem): boolean {
  return issue.pull_request != null;
}

function prClosedAt(pr: IssueItem): Date {
  return new Date(pr.pull_request?.merged_at ?? pr.closed_at);
}

function toIssue(issue: IssueItem, scopeLabels: string[]): ScrapedIssue {
  return {
    scopes: scopesOn(issue, scopeLabels),
    createdAt: new Date(issue.created_at),
    bug: hasLabel(issue, 'type: bug'),
  };
}

function toPr(pr: IssueItem, scopeLabels: string[]): ScrapedPr {
  return {
    scopes: scopesOn(pr, scopeLabels),
    createdAt: new Date(pr.created_at),
    merged: pr.pull_request?.merged_at != null,
  };
}

function scopesOn(issue: IssueItem, scopeLabels: string[]): string[] {
  return scopeLabels.filter((scope) => hasLabel(issue, scope));
}

function hasLabel(issue: IssueItem, labelName: string): boolean {
  return issue.labels.some(
    (l) => (typeof l === 'string' ? l : l.name) === labelName
  );
}
