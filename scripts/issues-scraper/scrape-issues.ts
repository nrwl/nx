import { Octokit } from 'octokit';
import { ReportData, ScopeData } from './model';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const now = new Date();

export async function scrapeIssues(prevDate?: Date): Promise<ReportData> {
  let total = 0;
  let totalBugs = 0;
  let untriagedIssueCount = 0;
  let totalClosed = 0;
  const scopeLabels = await getScopeLabels();
  const scopes: Record<string, ScopeData> = {};

  for await (const { data: slice } of getOpenIssueIterator()) {
    for (const issue of slice.filter(isNotPullRequest)) {
      const bug = hasLabel(issue, 'type: bug');

      if (bug) {
        totalBugs += 1;
      }
      total += 1;

      let triaged = false;
      for (const scope of scopeLabels) {
        if (hasLabel(issue, scope)) {
          scopes[scope] ??= { bugCount: 0, count: 0, closed: 0 };
          if (bug) {
            scopes[scope].bugCount += 1;
          }
          scopes[scope].count += 1;
          triaged = true;
        }
      }
      if (!triaged) {
        untriagedIssueCount += 1;
      }
    }
  }

  const sinceDate = getSinceDate(prevDate);
  for await (const { data: slice } of getClosedIssueIterator(sinceDate)) {
    for (const issue of slice.filter(isNotPullRequest)) {
      totalClosed += 1;

      for (const scope of scopeLabels) {
        if (hasLabel(issue, scope)) {
          scopes[scope] ??= { bugCount: 0, count: 0, closed: 0 };
          scopes[scope].closed += 1;
        }
      }
    }
  }

  return {
    scopes: scopes,
    totalBugCount: totalBugs,
    totalIssueCount: total,
    totalClosed,
    untriagedIssueCount,
    // Format is like: Mar 03 2023
    collectedDate: new Date().toDateString().split(' ').slice(1).join(' '),
  };
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

type IssueItem = Awaited<
  ReturnType<typeof octokit.rest.issues.listForRepo>
>['data'][number];

function isNotPullRequest(issue: IssueItem): boolean {
  return !('pull_request' in issue) || issue.pull_request == null;
}

function hasLabel(issue: IssueItem, labelName: string): boolean {
  return issue.labels.some(
    (l) => (typeof l === 'string' ? l : l.name) === labelName
  );
}
