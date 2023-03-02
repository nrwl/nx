import { ReportData } from './model';

export function getSlackMessageJson(body: string) {
  return {
    text: 'Some Text',
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
  trendData: ReportData,
  prevData: ReportData,
  unlabeledIssuesUrl: string
): string {
  const issueDelta = trendData.totalIssueCount;
  const formattedIssueDelta = formatDelta(issueDelta);

  const bugDelta = trendData.totalBugCount;
  const formattedBugDelta = formatDelta(bugDelta);

  const header = `Issue Report for ${currentData.collectedDate} <${unlabeledIssuesUrl}|[view unlabeled]>
\`\`\`
Totals, Issues: ${currentData.totalIssueCount} ${formattedIssueDelta} Bugs: ${currentData.totalBugCount} ${formattedBugDelta}\n\n`;

  const bodyLines: string[] = [
    ...(prevData.collectedDate
      ? [`Previous Report: ${prevData.collectedDate}`]
      : []),
    `Untriaged: ${currentData.untriagedIssueCount} ${formatDelta(
      trendData.untriagedIssueCount
    )}`,
  ];

  const sorted = Object.entries(currentData.scopes).sort(
    ([, a], [, b]) => b.count - a.count
  );

  const { bugPadding, issuePadding, scopePadding } = getPaddingValues(
    currentData,
    trendData
  );

  bodyLines.push(
    `| ${'Scope'.padEnd(scopePadding)} | ${'Issues'.padEnd(
      issuePadding
    )} | ${'Bugs'.padEnd(bugPadding)} |`
  );
  bodyLines.push('='.repeat(scopePadding + issuePadding + bugPadding + 10));
  for (const [scope, data] of sorted) {
    const formattedIssueDelta = formatDelta(trendData.scopes[scope].count);
    const formattedBugDelta = formatDelta(trendData.scopes[scope].bugCount);
    const issuesCell = `${data.count} ${formattedIssueDelta}`.padEnd(
      issuePadding
    );
    const bugCell = `${data.bugCount} ${formattedBugDelta}`.padEnd(bugPadding);
    bodyLines.push(
      `| ${scope.padEnd(scopePadding)} | ${issuesCell} | ${bugCell} |`
    );
  }
  const footer = '```';
  return header + bodyLines.join('\n') + footer;
}

function formatDelta(delta: number | null): string {
  if (delta === null || delta === 0) {
    return '';
  }

  return delta < 0 ? `(${delta})` : `(+${delta})`;
}

function getPaddingValues(data: ReportData, trendData: ReportData) {
  const scopes = Object.entries(data.scopes);
  const scopePadding = Math.max(...scopes.map((x) => x[0].length));
  const issuePadding =
    Math.max(
      ...scopes.map(
        (x) =>
          x[1].count.toString().length +
          formatDelta(trendData.scopes[x[0]].count).length
      )
    ) + 2;
  const bugPadding =
    Math.max(
      ...scopes.map(
        (x) =>
          x[1].bugCount.toString().length +
          formatDelta(trendData.scopes[x[0]].bugCount).length
      )
    ) + 2;
  return {
    scopePadding,
    issuePadding,
    bugPadding,
  };
}
