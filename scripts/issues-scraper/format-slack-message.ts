import { table } from 'markdown-factory';
import { SearchPath, searchUrl, toSearchDate } from './github-search';
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

export interface Cell {
  text: string;
  url: string;
}

export interface ReportTable {
  title: string;
  columns: { label: string; align: Align; linked: boolean }[];
  rows: Cell[][];
}

export interface FormattedReport {
  title: string;
  notes: string[];
  tables: ReportTable[];
  footer: Link;
}

type Row = {
  label: string;
  /** Search qualifiers that narrow a query to this row's scope. */
  filter: string[];
  data: ScopeData;
  trend: ScopeTrend;
};

type Column = {
  label: string;
  align: Align;
  /**
   * Slack caps a message's blocks at ~40k characters and a linked cell costs
   * ~190 of them, so only this column is a link there. Markdown links them all.
   */
  linked: boolean;
  value: (r: Row) => string;
  query: (since: string) => string[];
};

export function formatGhReport(
  currentData: ReportData,
  trendData: TrendData,
  prevData: Partial<ReportData>,
  scopeLabels: string[]
): FormattedReport {
  const prevDate = prevData.collectedDate
    ? new Date(prevData.collectedDate)
    : undefined;
  // The window is relative to the run that produced this data, not to whenever
  // the report happens to be rendered.
  const since = getSinceDate(
    prevDate,
    currentData.collectedDate ? new Date(currentData.collectedDate) : undefined
  );

  const rows = (
    sortBy: (d: ScopeData) => number,
    activity: (d: ScopeData) => number[]
  ): Row[] => [
    {
      label: 'Everything',
      filter: [],
      data: currentData.all,
      trend: trendData.all,
    },
    {
      label: 'Unscoped',
      filter: scopeLabels.map((l) => `-label:"${l}"`),
      data: currentData.unscoped,
      trend: trendData.unscoped,
    },
    ...Object.entries(currentData.scopes)
      .filter(([, data]) => activity(data).some((n) => n > 0))
      .sort(([, a], [, b]) => sortBy(b) - sortBy(a))
      .map(([scope, data]) => ({
        label: scope,
        filter: [`label:"${scope}"`],
        data,
        trend: trendData.scopes[scope],
      })),
  ];

  const issueTable = buildTable(
    'Issues',
    'issues',
    since,
    rows(
      (d) => d.issues.count,
      (d) => [d.issues.count, d.issues.bugCount, d.issues.closed]
    ),
    [
      scope(OPEN_ISSUES),
      count('Issues', OPEN_ISSUES, (r) => [
        r.data.issues.count,
        r.trend.issues.count,
      ]),
      count(
        'Bugs',
        () => [...OPEN_ISSUES(), 'label:"type: bug"'],
        (r) => [r.data.issues.bugCount, r.trend.issues.bugCount]
      ),
      count(
        'Closed',
        (since) => ['is:issue', 'is:closed', `closed:>=${since}`],
        (r) => [r.data.issues.closed, r.trend.issues.closed]
      ),
      age('Avg Age', OLDEST_OPEN_ISSUES, (r) => [
        r.data.issues.count,
        r.data.issues.avgAge,
        r.trend.issues.avgAge,
      ]),
      age('P95 Age', OLDEST_OPEN_ISSUES, (r) => [
        r.data.issues.count,
        r.data.issues.p95Age,
        r.trend.issues.p95Age,
      ]),
    ]
  );

  const prTable = buildTable(
    'Pull requests',
    'pulls',
    since,
    rows(
      (d) => d.prs.open,
      (d) => [d.prs.open, d.prs.created, d.prs.merged, d.prs.closed]
    ),
    [
      scope(OPEN_PRS),
      count('Open', OPEN_PRS, (r) => [r.data.prs.open, r.trend.prs.open]),
      count(
        'Created',
        (since) => ['is:pr', `created:>=${since}`],
        (r) => [r.data.prs.created, r.trend.prs.created]
      ),
      count(
        'Merged',
        (since) => ['is:pr', 'is:merged', `merged:>=${since}`],
        (r) => [r.data.prs.merged, r.trend.prs.merged]
      ),
      count(
        'Closed',
        (since) => ['is:pr', 'is:closed', 'is:unmerged', `closed:>=${since}`],
        (r) => [r.data.prs.closed, r.trend.prs.closed]
      ),
      age('Avg Age', OLDEST_OPEN_PRS, (r) => [
        r.data.prs.open,
        r.data.prs.avgAge,
        r.trend.prs.avgAge,
      ]),
      age('P95 Age', OLDEST_OPEN_PRS, (r) => [
        r.data.prs.open,
        r.data.prs.p95Age,
        r.trend.prs.p95Age,
      ]),
    ]
  );

  return {
    title: `Issue & PR Report for ${currentData.collectedDate}`,
    notes: [
      ...(prevData.collectedDate
        ? [`Previous Report: ${prevData.collectedDate}`]
        : []),
      `Closed, created and merged counts are since ${formatDate(
        since
      )}. Ages are for open items, in days.`,
    ],
    tables: [issueTable, prTable],
    footer: { label: 'nx package health on npm-burst', url: NPM_HEALTH_URL },
  };
}

type TableCell =
  | { type: 'raw_text'; text: string }
  | {
      type: 'rich_text';
      elements: {
        type: 'rich_text_section';
        elements: { type: 'link'; url: string; text: string }[];
      }[];
    };

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
    ...report.tables.flatMap((t) =>
      fencedTables
        ? [
            { type: 'divider' } as SlackBlock,
            section(`*${t.title}*`),
            ...splitIntoBlocks(toFencedTable(t), TABLE_HEADER_LINES).map(
              section
            ),
          ]
        : [section(`*${t.title}*`), toTableBlock(t)]
    ),
    context(slackLink(report.footer)),
  ];
}

export function toMarkdown(report: FormattedReport): string {
  const mdLink = (l: Link) => `[${l.label}](${l.url})`;
  return [
    `# ${report.title}`,
    report.notes.join('  \n'),
    ...report.tables.flatMap((t) => [`## ${t.title}`, toLinkedTable(t)]),
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

const OPEN_ISSUES = () => ['is:issue', 'is:open'];
const OPEN_PRS = () => ['is:pr', 'is:open'];
const OLDEST_OPEN_ISSUES = () => [...OPEN_ISSUES(), 'sort:created-asc'];
const OLDEST_OPEN_PRS = () => [...OPEN_PRS(), 'sort:created-asc'];

function scope(query: Column['query']): Column {
  return {
    label: 'Scope',
    align: 'left',
    linked: true,
    value: (r) => r.label,
    query,
  };
}

function count(
  label: string,
  query: Column['query'],
  pick: (r: Row) => [number, number | null]
): Column {
  return {
    label,
    align: 'right',
    linked: false,
    query,
    value: (r) => {
      const [value, delta] = pick(r);
      return `${value} ${formatDelta(delta)}`.trim();
    },
  };
}

function age(
  label: string,
  query: Column['query'],
  pick: (r: Row) => [number, number, number | null]
): Column {
  return {
    label,
    align: 'right',
    linked: false,
    query,
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
  path: SearchPath,
  since: Date,
  rows: Row[],
  columns: Column[]
): ReportTable {
  const searchDate = toSearchDate(since);
  return {
    title,
    columns: columns.map(({ label, align, linked }) => ({
      label,
      align,
      linked,
    })),
    rows: rows.map((row) =>
      columns.map((c) => ({
        text: c.value(row),
        url: searchUrl(path, [...c.query(searchDate), ...row.filter]),
      }))
    ),
  };
}

function toTableBlock(t: ReportTable): SlackBlock {
  return {
    type: 'table',
    column_settings: t.columns.map((c) => ({
      align: c.align,
      is_wrapped: true,
    })),
    rows: [
      t.columns.map((c): TableCell => ({ type: 'raw_text', text: c.label })),
      ...t.rows.map((row) =>
        row.map((cell, idx): TableCell =>
          t.columns[idx].linked
            ? {
                type: 'rich_text',
                elements: [
                  {
                    type: 'rich_text_section',
                    elements: [
                      { type: 'link', url: cell.url, text: cell.text },
                    ],
                  },
                ],
              }
            : { type: 'raw_text', text: cell.text }
        )
      ),
    ],
  };
}

// Only the fenced fallback needs fixed-width padding; padding a table of link
// markup just makes the job summary's source unreadable.
function toLinkedTable(t: ReportTable): string {
  const line = (cells: string[]) => `| ${cells.join(' | ')} |`;
  return [
    line(t.columns.map((c) => c.label)),
    line(t.columns.map(() => '---')),
    ...t.rows.map((r) => line(r.map((c) => `[${c.text}](${c.url})`))),
  ].join('\n');
}

function toFencedTable(t: ReportTable): string {
  return table(
    t.rows.map((cells) => ({ cells })),
    t.columns.map((c, idx) => ({
      label: c.label,
      mapFn: (r: { cells: Cell[] }) => r.cells[idx].text,
    }))
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
