import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatGhReport,
  getSlackMessageJson,
  splitIntoBlocks,
  toMarkdown,
  toSlackBlocks,
} from './format-slack-message';
import { ReportData, ScopeData, ScopeTrend, TrendData } from './model';

const stats = (n: number): ScopeData => ({
  issues: { count: n, bugCount: n, closed: n, avgAge: n * 10, p95Age: n * 20 },
  prs: {
    open: n,
    created: n,
    merged: n,
    closed: n,
    avgAge: n * 3,
    p95Age: n * 4,
  },
});
const trend = (n: number | null): ScopeTrend => ({
  issues: { count: n, bugCount: n, closed: n, avgAge: n, p95Age: n },
  prs: { open: n, created: n, merged: n, closed: n, avgAge: n, p95Age: n },
});

const current: ReportData = {
  all: stats(9),
  unscoped: stats(2),
  scopes: {
    'scope: small': stats(1),
    'scope: big': stats(5),
    'scope: none': { ...stats(0), issues: { ...stats(0).issues, closed: 1 } },
  },
  collectedDate: 'Aug 30 2026',
};
const trends: TrendData = {
  all: trend(1),
  unscoped: trend(-1),
  scopes: {
    'scope: small': trend(0),
    'scope: big': trend(2),
    'scope: none': trend(null),
  },
};
const previous: Partial<ReportData> = { collectedDate: 'Aug 23 2026' };
const scopeLabels = ['scope: small', 'scope: big', 'scope: none'];

const labels = (columns: { label: string }[]) => columns.map((c) => c.label);
const texts = (cells: { text: string }[]) => cells.map((c) => c.text);
const row = (rows: { text: string }[][], label: string) => {
  const found = rows.find((r) => r[0].text === label);
  return found && texts(found);
};
const cellsOf = (rows: { text: string; url: string }[][], label: string) =>
  rows.find((r) => r[0].text === label);
const query = (url: string) =>
  decodeURIComponent(new URL(url).searchParams.get('q'));

describe('formatGhReport', () => {
  const report = formatGhReport(current, trends, previous, scopeLabels);
  const [issues, prs] = report.tables;

  it('describes the report with a title, notes, two titled tables and a footer link', () => {
    assert.equal(report.title, 'Issue & PR Report for Aug 30 2026');
    assert.deepEqual(report.notes, [
      'Previous Report: Aug 23 2026',
      'Closed, created and merged counts are since Aug 23 2026. Ages are for open items, in days.',
    ]);
    assert.equal(issues.title, 'Issues');
    assert.equal(prs.title, 'Pull requests');
    assert.deepEqual(report.footer, {
      label: 'nx package health on npm-burst',
      url: 'https://npm-burst.com/package/nx/health/',
    });
  });

  it('omits the previous-report note on a first run', () => {
    const first = formatGhReport(current, trends, {}, scopeLabels);
    assert.equal(first.notes.length, 1);
    assert.doesNotMatch(first.notes[0], /Previous/);
  });

  it('takes the since window from the collected date, not from the wall clock', () => {
    const stale = formatGhReport(
      { ...current, collectedDate: 'Mar 04 2021' },
      trends,
      { collectedDate: 'Feb 25 2021' },
      scopeLabels
    );
    assert.match(stale.notes[1], /since Feb 25 2021\./);
    assert.equal(
      query(stale.tables[0].rows[0][3].url),
      'is:issue is:closed closed:>=2021-02-25'
    );
  });

  it('falls back to the previous month when the last report predates it', () => {
    const cold = formatGhReport(
      { ...current, collectedDate: 'Mar 04 2021' },
      trends,
      { collectedDate: 'Nov 02 2020' },
      scopeLabels
    );
    assert.match(cold.notes[1], /since Feb 01 2021\./);
  });

  it('labels the scope column left aligned and every stat column right aligned', () => {
    for (const t of report.tables) {
      assert.equal(t.columns[0].align, 'left');
      assert.deepEqual(
        t.columns.slice(1).map((c) => c.align),
        t.columns.slice(1).map(() => 'right')
      );
    }
    assert.deepEqual(labels(issues.columns), [
      'Scope',
      'Issues',
      'Bugs',
      'Closed',
      'Avg Age',
      'P95 Age',
    ]);
    assert.deepEqual(labels(prs.columns), [
      'Scope',
      'Open',
      'Created',
      'Merged',
      'Closed',
      'Avg Age',
      'P95 Age',
    ]);
  });

  it('lists Everything, then Unscoped, then scopes by descending open count', () => {
    const expected = ['Everything', 'Unscoped', 'scope: big', 'scope: small'];
    assert.deepEqual(
      issues.rows.map((r) => r[0].text),
      [...expected, 'scope: none']
    );
    assert.deepEqual(
      prs.rows.map((r) => r[0].text),
      expected
    );
  });

  it('renders counts with deltas and ages in days', () => {
    assert.deepEqual(row(issues.rows, 'Everything'), [
      'Everything',
      '9 (+1)',
      '9 (+1)',
      '9 (+1)',
      '90d (+1)',
      '180d (+1)',
    ]);
    assert.deepEqual(row(issues.rows, 'Unscoped'), [
      'Unscoped',
      '2 (-1)',
      '2 (-1)',
      '2 (-1)',
      '20d (-1)',
      '40d (-1)',
    ]);
    assert.deepEqual(row(prs.rows, 'scope: small'), [
      'scope: small',
      '1',
      '1',
      '1',
      '1',
      '3d',
      '4d',
    ]);
  });

  it('shows a dash for ages when nothing is open', () => {
    assert.deepEqual(row(issues.rows, 'scope: none'), [
      'scope: none',
      '0',
      '0',
      '1',
      '-',
      '-',
    ]);
  });

  it('omits scope rows with no activity at all from a table', () => {
    assert.equal(row(prs.rows, 'scope: none'), undefined);
  });
});

describe('search links', () => {
  const report = formatGhReport(current, trends, previous, scopeLabels);
  const [issues, prs] = report.tables;
  const cell = (t: typeof issues, rowLabel: string, column: string) => {
    const idx = t.columns.findIndex((c) => c.label === column);
    return cellsOf(t.rows, rowLabel)[idx];
  };
  const q = (t: typeof issues, rowLabel: string, column: string) =>
    query(cell(t, rowLabel, column).url);

  it('points the issue table at /issues and the PR table at /pulls', () => {
    for (const row of issues.rows) {
      for (const c of row) {
        assert.ok(c.url.startsWith('https://github.com/nrwl/nx/issues?q='));
      }
    }
    for (const row of prs.rows) {
      for (const c of row) {
        assert.ok(c.url.startsWith('https://github.com/nrwl/nx/pulls?q='));
      }
    }
  });

  it('narrows a scope row by its label and leaves Everything unfiltered', () => {
    assert.equal(q(issues, 'Everything', 'Issues'), 'is:issue is:open');
    assert.equal(
      q(issues, 'scope: big', 'Issues'),
      'is:issue is:open label:"scope: big"'
    );
  });

  it('narrows the Unscoped row by negating every scope label', () => {
    assert.equal(
      q(issues, 'Unscoped', 'Issues'),
      'is:issue is:open -label:"scope: small" -label:"scope: big" -label:"scope: none"'
    );
  });

  it('matches each column to the query the number was counted from', () => {
    assert.equal(
      q(issues, 'scope: big', 'Bugs'),
      'is:issue is:open label:"type: bug" label:"scope: big"'
    );
    assert.equal(
      q(issues, 'scope: big', 'Closed'),
      'is:issue is:closed closed:>=2026-08-23 label:"scope: big"'
    );
    assert.equal(
      q(prs, 'scope: big', 'Open'),
      'is:pr is:open label:"scope: big"'
    );
    assert.equal(
      q(prs, 'scope: big', 'Created'),
      'is:pr created:>=2026-08-23 label:"scope: big"'
    );
    assert.equal(
      q(prs, 'scope: big', 'Merged'),
      'is:pr is:merged merged:>=2026-08-23 label:"scope: big"'
    );
    assert.equal(
      q(prs, 'scope: big', 'Closed'),
      'is:pr is:closed is:unmerged closed:>=2026-08-23 label:"scope: big"'
    );
  });

  it('sorts the age columns oldest first, since the ages come from open items', () => {
    for (const column of ['Avg Age', 'P95 Age']) {
      assert.equal(
        q(issues, 'scope: big', column),
        'is:issue is:open sort:created-asc label:"scope: big"'
      );
      assert.equal(
        q(prs, 'scope: big', column),
        'is:pr is:open sort:created-asc label:"scope: big"'
      );
    }
  });
});

describe('toSlackBlocks', () => {
  const report = formatGhReport(current, trends, previous, scopeLabels);
  const blocks = toSlackBlocks(report);
  const types = blocks.map((b) => b.type);

  it('lays out header, context notes, then a labelled table block per section, then a context footer', () => {
    assert.deepEqual(types, [
      'header',
      'context',
      'section',
      'table',
      'section',
      'table',
      'context',
    ]);
  });

  it('leaves out the dividers, since a table block draws its own border', () => {
    assert.ok(!types.includes('divider'));
  });

  it('puts the title in a plain_text header and the notes in a context block', () => {
    assert.deepEqual(blocks[0], {
      type: 'header',
      text: { type: 'plain_text', text: 'Issue & PR Report for Aug 30 2026' },
    });
    assert.deepEqual(blocks[1], {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: 'Previous Report: Aug 23 2026\nClosed, created and merged counts are since Aug 23 2026. Ages are for open items, in days.',
        },
      ],
    });
  });

  it('renders the footer as a context link', () => {
    assert.deepEqual(blocks[6], {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '<https://npm-burst.com/package/nx/health/|nx package health on npm-burst>',
        },
      ],
    });
  });

  it('labels each table in bold, directly above it', () => {
    assert.deepEqual(blocks[2], {
      type: 'section',
      text: { type: 'mrkdwn', text: '*Issues*' },
    });
    assert.deepEqual(blocks[4], {
      type: 'section',
      text: { type: 'mrkdwn', text: '*Pull requests*' },
    });
  });

  it('links the scope cell and sends every other cell as plain text', () => {
    for (const [idx, block] of [blocks[3], blocks[5]].entries()) {
      assert.equal(block.type, 'table');
      const t = block as Extract<(typeof blocks)[number], { type: 'table' }>;
      const source = report.tables[idx];
      assert.deepEqual(
        t.rows[0].map((c) => (c as { text: string }).text),
        labels(source.columns)
      );
      for (const [r, row] of t.rows.slice(1).entries()) {
        for (const [c, cell] of row.entries()) {
          const want = source.rows[r][c];
          if (c === 0) {
            assert.equal(cell.type, 'rich_text');
            assert.deepEqual(
              (cell as { elements: { elements: unknown[] }[] }).elements[0]
                .elements,
              [{ type: 'link', url: want.url, text: want.text }]
            );
          } else {
            assert.deepEqual(cell, { type: 'raw_text', text: want.text });
          }
        }
      }
      assert.deepEqual(
        t.column_settings,
        source.columns.map((c) => ({ align: c.align, is_wrapped: true }))
      );
    }
  });

  it('only ever posts raw_text and rich_text cells, the two Slack accepts', () => {
    for (const block of [blocks[3], blocks[5]]) {
      const t = block as Extract<(typeof blocks)[number], { type: 'table' }>;
      for (const cell of t.rows.flat()) {
        assert.ok(['raw_text', 'rich_text'].includes(cell.type), cell.type);
      }
    }
  });

  it('keeps the blocks payload inside the budget Slack enforces', () => {
    const big = formatGhReport(
      {
        all: stats(9),
        unscoped: stats(2),
        scopes: Object.fromEntries(
          Array.from({ length: 40 }, (_, i) => [`scope: s${i}`, stats(i + 1)])
        ),
        collectedDate: 'Aug 30 2026',
      },
      {
        all: trend(1),
        unscoped: trend(-1),
        scopes: Object.fromEntries(
          Array.from({ length: 40 }, (_, i) => [`scope: s${i}`, trend(1)])
        ),
      },
      previous,
      Array.from({ length: 40 }, (_, i) => `scope: s${i}`)
    );
    const size = JSON.stringify(toSlackBlocks(big)).length;
    assert.ok(size < 40_000, `blocks payload of ${size} chars`);
  });

  it('stays within the table block limits Slack enforces', () => {
    for (const block of [blocks[3], blocks[5]]) {
      const t = block as Extract<(typeof blocks)[number], { type: 'table' }>;
      assert.ok(t.rows.length <= 100, `${t.rows.length} rows`);
      assert.ok(t.rows[0].length <= 20, `${t.rows[0].length} columns`);
      for (const r of t.rows) {
        assert.equal(r.length, t.column_settings.length);
      }
    }
  });
});

describe('toSlackBlocks with fencedTables', () => {
  const report = formatGhReport(current, trends, previous, scopeLabels);
  const blocks = toSlackBlocks(report, { fencedTables: true });

  it('swaps every table block for divider-separated fenced markdown sections', () => {
    assert.deepEqual(
      blocks.map((b) => b.type),
      [
        'header',
        'context',
        'divider',
        'section',
        'section',
        'divider',
        'section',
        'section',
        'context',
      ]
    );
    for (const block of [blocks[4], blocks[7]]) {
      const text = (block as { text: { text: string } }).text.text;
      assert.ok(text.startsWith('```\n| Scope'));
      assert.ok(text.endsWith('\n```'));
    }
  });
});

describe('splitIntoBlocks', () => {
  it('leaves short text as a single fenced block', () => {
    assert.deepEqual(splitIntoBlocks('a\nb'), ['```\na\nb\n```']);
  });

  it('repeats the table header at the top of every continuation block', () => {
    const header = ['| Scope | N |', '| ----- | - |'];
    const rows = Array.from(
      { length: 200 },
      (_, i) => `| row ${i} | ${'x'.repeat(60)} |`
    );
    const blocks = splitIntoBlocks([...header, ...rows].join('\n'), 2);
    assert.ok(blocks.length > 1);
    for (const block of blocks) {
      assert.deepEqual(block.split('\n').slice(1, 3), header);
    }
    const rejoined = blocks.flatMap((b) => b.split('\n').slice(3, -1));
    assert.deepEqual(rejoined, rows);
  });

  it('splits on line boundaries so each fenced block fits in a Slack section', () => {
    const lines = Array.from(
      { length: 200 },
      (_, i) => `row ${i} ${'x'.repeat(60)}`
    );
    const blocks = splitIntoBlocks(lines.join('\n'));
    assert.ok(blocks.length > 1);
    for (const block of blocks) {
      assert.ok(block.length <= 3000, `block of ${block.length} chars`);
      assert.ok(block.startsWith('```\n') && block.endsWith('\n```'));
    }
    const rejoined = blocks.map((b) => b.slice(4, -4)).join('\n');
    assert.equal(rejoined, lines.join('\n'));
  });
});

describe('toMarkdown', () => {
  const markdown = toMarkdown(
    formatGhReport(current, trends, previous, scopeLabels)
  );

  it('renders headings and unfenced tables for GitHub', () => {
    assert.match(markdown, /^# Issue & PR Report for Aug 30 2026\n/);
    assert.match(markdown, /\n## Issues\n\n\| Scope/);
    assert.match(markdown, /\n## Pull requests\n\n\| Scope/);
    assert.match(
      markdown,
      /\[nx package health on npm-burst\]\(https:\/\/npm-burst.com\/package\/nx\/health\/\)/
    );
    assert.doesNotMatch(markdown, /```/);
    assert.doesNotMatch(markdown, /<https/);
  });

  it('links every cell, which markdown has the room for and Slack does not', () => {
    assert.match(
      markdown,
      /\| \[Everything\]\(https:\/\/github\.com\/nrwl\/nx\/issues\?q=is:issue\+is:open\) \| \[9 \(\+1\)\]\(/
    );
    const cells = markdown
      .split('\n')
      .filter((l) => l.startsWith('| ['))
      .flatMap((l) => l.split(' | '));
    assert.ok(cells.length > 0);
    for (const cell of cells) {
      assert.match(cell, /\[[^\]]+\]\(https:\/\/github\.com\/nrwl\/nx\//);
    }
  });
});

describe('getSlackMessageJson', () => {
  it('uses the title as the notification fallback and the rendered blocks', () => {
    const report = formatGhReport(current, trends, previous, scopeLabels);
    const json = getSlackMessageJson(report);
    assert.equal(json.text, 'Issue & PR Report for Aug 30 2026');
    assert.deepEqual(json.blocks, toSlackBlocks(report));
  });

  it('passes the fenced-table fallback through to the blocks', () => {
    const report = formatGhReport(current, trends, previous, scopeLabels);
    const json = getSlackMessageJson(report, { fencedTables: true });
    assert.deepEqual(
      json.blocks,
      toSlackBlocks(report, { fencedTables: true })
    );
  });
});
