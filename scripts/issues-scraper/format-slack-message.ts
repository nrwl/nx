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

export type Align = 'left' | 'right';

export interface ReportTable {
  title: string;
  columns: { label: string; align: Align }[];
  rows: string[][];
}

export interface FormattedReport {
  title: string;
  links: Link[];
  notes: string[];
  tables: ReportTable[];
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

type Column = {
  label: string;
  align: Align;
  value: (r: Row) => string;
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

  const issueTable = buildTable(
    'Issues',
    rows(
      (d) => d.issues.count,
      (d) => [d.issues.count, d.issues.bugCount, d.issues.closed]
    ),
    [
      scope,
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

  const prTable = buildTable(
    'Pull requests',
    rows(
      (d) => d.prs.open,
      (d) => [d.prs.open, d.prs.created, d.prs.merged, d.prs.closed]
    ),
    [
      scope,
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
    tables: [issueTable, prTable],
    footer: { label: 'nx package health on npm-burst', url: NPM_HEALTH_URL },
  };
}

type TableCell = { type: 'raw_text'; text: string };

type SlackBlock =
  | { type: 'header'; text: { type: 'plain_text'; text: string } }
  | { type: 'section'; text: { type: 'mrkdwn'; text: string } }
  | { type: 'context'; elements: { type: 'mrkdwn'; text: string }[] }
  | { type: 'divider' }
  | {
      type: 'table';
      rows: TableCell[][];
      column_settings: { align: Align; is_wrapped: boolean }[];
    };

export interface SlackOptions {
  /** Fall back to fixed-width markdown in a code fence if table blocks ever stop working. */
  fencedTables?: boolean;
}

export function toSlackBlocks(
  report: FormattedReport,
  { fencedTables = false }: SlackOptions = {}
): SlackBlock[] {
  const slackLink = (l: Link) => `<${l.url}|${l.label}>`;
  const section = (text: string): SlackBlock => ({
    type: 'section',
    text: { type: 'mrkdwn', text },
  });
  const context = (text: string): SlackBlock => ({
    type: 'context',
    elements: [{ type: 'mrkdwn', text }],
  });
  return [
    { type: 'header', text: { type: 'plain_text', text: report.title } },
    context(report.notes.join('\n')),
    ...report.links.map((l) => section(slackLink(l))),
    ...report.tables.flatMap((t) => [
      { type: 'divider' } as SlackBlock,
      section(`*${t.title}*`),
      ...(fencedTables
        ? splitIntoBlocks(toMarkdownTable(t), TABLE_HEADER_LINES).map(section)
        : [toTableBlock(t)]),
    ]),
    context(slackLink(report.footer)),
  ];
}

export function toMarkdown(report: FormattedReport): string {
  const mdLink = (l: Link) => `[${l.label}](${l.url})`;
  return [
    `# ${report.title}`,
    report.notes.join('  \n'),
    report.links.map(mdLink).join(' · '),
    ...report.tables.flatMap((t) => [`## ${t.title}`, toMarkdownTable(t)]),
    mdLink(report.footer),
  ].join('\n\n');
}

export function getSlackMessageJson(
  report: FormattedReport,
  options?: SlackOptions
) {
  return { text: report.title, blocks: toSlackBlocks(report, options) };
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

const scope: Column = {
  label: 'Scope',
  align: 'left',
  value: (r) => r.label,
};

function count(
  label: string,
  pick: (r: Row) => [number, number | null]
): Column {
  return {
    label,
    align: 'right',
    value: (r) => {
      const [value, delta] = pick(r);
      return `${value} ${formatDelta(delta)}`.trim();
    },
  };
}

function age(
  label: string,
  pick: (r: Row) => [number, number, number | null]
): Column {
  return {
    label,
    align: 'right',
    value: (r) => {
      const [openCount, value, delta] = pick(r);
      if (openCount === 0) {
        return '-';
      }
      return `${value}d ${formatDelta(delta)}`.trim();
    },
  };
}

function buildTable(
  title: string,
  rows: Row[],
  columns: Column[]
): ReportTable {
  return {
    title,
    columns: columns.map(({ label, align }) => ({ label, align })),
    rows: rows.map((row) => columns.map((c) => c.value(row))),
  };
}

function toTableBlock(t: ReportTable): SlackBlock {
  const cell = (text: string): TableCell => ({ type: 'raw_text', text });
  return {
    type: 'table',
    column_settings: t.columns.map((c) => ({
      align: c.align,
      is_wrapped: true,
    })),
    rows: [
      t.columns.map((c) => cell(c.label)),
      ...t.rows.map((row) => row.map(cell)),
    ],
  };
}

function toMarkdownTable(t: ReportTable): string {
  return table(
    t.rows.map((cells) => ({ cells })),
    t.columns.map((c, idx) => ({ label: c.label, mapFn: (r) => r.cells[idx] }))
  );
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
