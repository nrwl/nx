import { table } from 'markdown-factory';
import { ReportData, ScopeData, ScopeTrend, TrendData } from './model';
import { getSinceDate } from './scrape-issues';

const SLACK_SECTION_TEXT_LIMIT = 3000;
const TABLE_HEADER_LINES = 2;
const NPM_HEALTH_URL = 'https://npm-burst.com/package/nx/health/';

export interface Link {
  label: string;
  url: string;
}

export interface FormattedReport {
  title: string;
  links: Link[];
  notes: string[];
  tables: { title: string; markdown: string }[];
  footer: Link;
}

export interface ReportLinks {
  unlabeledIssuesUrl: string;
  unlabeledPrsUrl: string;
}

type Row = {
  label: string;
  data: ScopeData;
  trend: ScopeTrend;
};

export function formatGhReport(
  currentData: ReportData,
  trendData: TrendData,
  prevData: Partial<ReportData>,
  links: ReportLinks
): FormattedReport {
  const prevDate = prevData.collectedDate
    ? new Date(prevData.collectedDate)
    : undefined;
  const sinceDate = formatDate(getSinceDate(prevDate));

  const rows = (
    sortBy: (d: ScopeData) => number,
    activity: (d: ScopeData) => number[]
  ): Row[] => [
    { label: 'Everything', data: currentData.all, trend: trendData.all },
    {
      label: 'Unscoped',
      data: currentData.unscoped,
      trend: trendData.unscoped,
    },
    ...Object.entries(currentData.scopes)
      .filter(([, data]) => activity(data).some((n) => n > 0))
      .sort(([, a], [, b]) => sortBy(b) - sortBy(a))
      .map(([scope, data]) => ({
        label: scope,
        data,
        trend: trendData.scopes[scope],
      })),
  ];

  const issueTable = table<Row>(
    rows(
      (d) => d.issues.count,
      (d) => [d.issues.count, d.issues.bugCount, d.issues.closed]
    ),
    [
      { label: 'Scope', field: 'label' },
      count('Issues', (r) => [r.data.issues.count, r.trend.issues.count]),
      count('Bugs', (r) => [r.data.issues.bugCount, r.trend.issues.bugCount]),
      count('Closed', (r) => [r.data.issues.closed, r.trend.issues.closed]),
      age('Avg Age', (r) => [
        r.data.issues.count,
        r.data.issues.avgAge,
        r.trend.issues.avgAge,
      ]),
      age('P95 Age', (r) => [
        r.data.issues.count,
        r.data.issues.p95Age,
        r.trend.issues.p95Age,
      ]),
    ]
  );

  const prTable = table<Row>(
    rows(
      (d) => d.prs.open,
      (d) => [d.prs.open, d.prs.created, d.prs.merged, d.prs.closed]
    ),
    [
      { label: 'Scope', field: 'label' },
      count('Open', (r) => [r.data.prs.open, r.trend.prs.open]),
      count('Created', (r) => [r.data.prs.created, r.trend.prs.created]),
      count('Merged', (r) => [r.data.prs.merged, r.trend.prs.merged]),
      count('Closed', (r) => [r.data.prs.closed, r.trend.prs.closed]),
      age('Avg Age', (r) => [
        r.data.prs.open,
        r.data.prs.avgAge,
        r.trend.prs.avgAge,
      ]),
      age('P95 Age', (r) => [
        r.data.prs.open,
        r.data.prs.p95Age,
        r.trend.prs.p95Age,
      ]),
    ]
  );

  return {
    title: `Issue & PR Report for ${currentData.collectedDate}`,
    links: [
      { label: 'view unlabeled issues', url: links.unlabeledIssuesUrl },
      { label: 'view unlabeled PRs', url: links.unlabeledPrsUrl },
    ],
    notes: [
      ...(prevData.collectedDate
        ? [`Previous Report: ${prevData.collectedDate}`]
        : []),
      `Closed, created and merged counts are since ${sinceDate}. Ages are for open items, in days.`,
    ],
    tables: [
      { title: 'Issues', markdown: issueTable },
      { title: 'Pull requests', markdown: prTable },
    ],
    footer: { label: 'nx package health on npm-burst', url: NPM_HEALTH_URL },
  };
}

export function toSlackSections(report: FormattedReport): string[] {
  const slackLink = (l: Link) => `<${l.url}|${l.label}>`;
  const header = [
    [
      `*${report.title}*`,
      ...report.links.map((l) => `<${l.url}|[${l.label}]>`),
    ].join(' '),
    ...report.notes,
  ].join('\n');
  return [
    header,
    ...report.tables.flatMap((t) => [
      `*${t.title}*`,
      ...splitIntoBlocks(t.markdown, TABLE_HEADER_LINES),
    ]),
    slackLink(report.footer),
  ];
}

export function toMarkdown(report: FormattedReport): string {
  const mdLink = (l: Link) => `[${l.label}](${l.url})`;
  return [
    `# ${report.title}`,
    report.notes.join('  \n'),
    report.links.map(mdLink).join(' · '),
    ...report.tables.flatMap((t) => [`## ${t.title}`, t.markdown]),
    mdLink(report.footer),
  ].join('\n\n');
}

export function getSlackMessageJson(fallbackText: string, sections: string[]) {
  return {
    text: fallbackText,
    blocks: sections.map((text) => ({
      type: 'section',
      text: { type: 'mrkdwn', text },
    })),
  };
}

function count(label: string, pick: (r: Row) => [number, number | null]) {
  return {
    label,
    mapFn: (r: Row) => {
      const [value, delta] = pick(r);
      return `${value} ${formatDelta(delta)}`.trim();
    },
  };
}

function age(label: string, pick: (r: Row) => [number, number, number | null]) {
  return {
    label,
    mapFn: (r: Row) => {
      const [openCount, value, delta] = pick(r);
      if (openCount === 0) {
        return '-';
      }
      return `${value}d ${formatDelta(delta)}`.trim();
    },
  };
}

export function splitIntoBlocks(text: string, headerLines = 0): string[] {
  const lines = text.split('\n');
  const header = lines.slice(0, headerLines);
  const fence = (body: string[]) => `\`\`\`\n${body.join('\n')}\n\`\`\``;
  const blocks: string[] = [];
  let current = [...header];
  for (const line of lines.slice(headerLines)) {
    if (
      current.length > header.length &&
      fence([...current, line]).length > SLACK_SECTION_TEXT_LIMIT
    ) {
      blocks.push(fence(current));
      current = [...header];
    }
    current.push(line);
  }
  blocks.push(fence(current));
  return blocks;
}

function formatDate(date: Date): string {
  // Format is like: Mar 03 2023
  return date.toDateString().split(' ').slice(1).join(' ');
}

function formatDelta(delta: number | null): string {
  if (delta === null || delta === 0) {
    return '';
  }
  return delta < 0 ? `(${delta})` : `(+${delta})`;
}
