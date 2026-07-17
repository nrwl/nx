import { ReportData, TrendData } from './model';
import { getSinceDate } from './scrape-issues';
import { table } from 'markdown-factory';

export function getSlackMessageJson(body: string) {
  return {
    blocks: [
      {
        type: 'section',
        text: {
          text: body,
          type: 'mrkdwn',
        },
      },
    ],
  };
}

export function formatGhReport(
  currentData: ReportData,
  trendData: TrendData,
  prevData: ReportData,
  unlabeledIssuesUrl: string
): string {
  const formattedIssueDelta = formatDelta(trendData.totalIssueCount);
  const formattedBugDelta = formatDelta(trendData.totalBugCount);

  const header = `Issue Report for ${currentData.collectedDate} <${unlabeledIssuesUrl}|[view unlabeled]>
\`\`\`
Totals, Issues: ${currentData.totalIssueCount} ${formattedIssueDelta} Bugs: ${currentData.totalBugCount} ${formattedBugDelta}\n\n`;

  const prevDate = prevData.collectedDate
    ? new Date(prevData.collectedDate)
    : undefined;
  const closedSinceDate = getSinceDate(prevDate)
    .toDateString()
    .split(' ')
    .slice(1)
    .join(' ');

  const bodyLines: string[] = [
    ...(prevData.collectedDate
      ? [`Previous Report: ${prevData.collectedDate}`]
      : []),
    `Untriaged: ${currentData.untriagedIssueCount} ${formatDelta(
      trendData.untriagedIssueCount
    )}`,
    `Closed since ${closedSinceDate}: ${currentData.totalClosed} ${formatDelta(
      trendData.totalClosed
    )}`,
  ];

  const sorted = Object.entries(currentData.scopes)
    .sort(([, a], [, b]) => b.count - a.count)
    .map(([scope, x]) => ({
      ...x,
      scope,
    }));

  bodyLines.push(
    table(sorted, [
      {
        field: 'scope',
        label: 'Scope',
      },
      {
        label: 'Issues',
        mapFn: (el) =>
          `${el.count} ${formatDelta(trendData.scopes[el.scope].count)}`,
      },
      {
        label: 'Bugs',
        mapFn: (el) =>
          `${el.bugCount} ${formatDelta(trendData.scopes[el.scope].bugCount)}`,
      },
      {
        label: 'Closed',
        mapFn: (el) =>
          `${el.closed} ${formatDelta(trendData.scopes[el.scope].closed)}`,
      },
    ])
  );

  const footer = '```';
  return header + bodyLines.join('\n') + footer;
}

function formatDelta(delta: number | null): string {
  if (delta === null || delta === 0) {
    return '';
  }
  return delta < 0 ? `(${delta})` : `(+${delta})`;
}
