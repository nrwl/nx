import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatGhReport,
  getSlackMessageJson,
  splitIntoBlocks,
  toMarkdown,
  toSlackSections,
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
const links = {
  unlabeledIssuesUrl: 'https://example.com/issues',
  unlabeledPrsUrl: 'https://example.com/prs',
};

const squash = (s: string) => s.replace(/ +/g, ' ');
const rowLabels = (table: string) =>
  table
    .split('\n')
    .filter((l) => l.startsWith('|'))
    .slice(2)
    .map((l) => l.split('|')[1].trim());

describe('formatGhReport', () => {
  const report = formatGhReport(current, trends, previous, links);
  const [issues, prs] = report.tables;

  it('describes the report with a title, links, notes, two titled tables and a footer link', () => {
    assert.equal(report.title, 'Issue & PR Report for Aug 30 2026');
    assert.deepEqual(report.links, [
      { label: 'view unlabeled issues', url: 'https://example.com/issues' },
      { label: 'view unlabeled PRs', url: 'https://example.com/prs' },
    ]);
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
    const first = formatGhReport(current, trends, {}, links);
    assert.equal(first.notes.length, 1);
    assert.doesNotMatch(first.notes[0], /Previous/);
  });

  it('lists Everything, then Unscoped, then scopes by descending open count', () => {
    const expected = ['Everything', 'Unscoped', 'scope: big', 'scope: small'];
    assert.deepEqual(rowLabels(issues.markdown), [...expected, 'scope: none']);
    assert.deepEqual(rowLabels(prs.markdown), expected);
  });

  it('renders counts with deltas and ages in days', () => {
    assert.match(issues.markdown, /Issues.*Bugs.*Closed.*Avg Age.*P95 Age/);
    assert.match(
      prs.markdown,
      /Open.*Created.*Merged.*Closed.*Avg Age.*P95 Age/
    );
    assert.match(
      squash(issues.markdown),
      /\| Everything \| 9 \(\+1\) \| 9 \(\+1\) \| 9 \(\+1\) \| 90d \(\+1\) \| 180d \(\+1\) \|/
    );
    assert.match(
      squash(issues.markdown),
      /\| Unscoped \| 2 \(-1\) \| 2 \(-1\) \| 2 \(-1\) \| 20d \(-1\) \| 40d \(-1\) \|/
    );
    assert.match(
      squash(prs.markdown),
      /\| scope: small \| 1 \| 1 \| 1 \| 1 \| 3d \| 4d \|/
    );
  });

  it('shows a dash for ages when nothing is open', () => {
    assert.match(
      squash(issues.markdown),
      /\| scope: none \| 0 \| 0 \| 1 \| - \| - \|/
    );
  });

  it('omits scope rows with no activity at all from a table', () => {
    assert.doesNotMatch(prs.markdown, /scope: none/);
  });
});

describe('toSlackSections', () => {
  const sections = toSlackSections(
    formatGhReport(current, trends, previous, links)
  );

  it('emits header, a bold label plus fenced chunks per table, then the footer', () => {
    assert.equal(sections.length, 6);
    const [header, issuesLabel, issues, prsLabel, prs, footer] = sections;
    assert.equal(
      header,
      [
        '*Issue & PR Report for Aug 30 2026* <https://example.com/issues|[view unlabeled issues]> <https://example.com/prs|[view unlabeled PRs]>',
        'Previous Report: Aug 23 2026',
        'Closed, created and merged counts are since Aug 23 2026. Ages are for open items, in days.',
      ].join('\n')
    );
    assert.equal(issuesLabel, '*Issues*');
    assert.equal(prsLabel, '*Pull requests*');
    for (const section of [issues, prs]) {
      assert.ok(section.startsWith('```\n| Scope'));
      assert.ok(section.endsWith('\n```'));
    }
    assert.equal(
      footer,
      '<https://npm-burst.com/package/nx/health/|nx package health on npm-burst>'
    );
  });
});

describe('toMarkdown', () => {
  const markdown = toMarkdown(formatGhReport(current, trends, previous, links));

  it('renders headings, plain links and unfenced tables for GitHub', () => {
    assert.match(markdown, /^# Issue & PR Report for Aug 30 2026\n/);
    assert.match(
      markdown,
      /\[view unlabeled issues\]\(https:\/\/example.com\/issues\)/
    );
    assert.match(
      markdown,
      /\[view unlabeled PRs\]\(https:\/\/example.com\/prs\)/
    );
    assert.match(markdown, /\n## Issues\n\n\| Scope/);
    assert.match(markdown, /\n## Pull requests\n\n\| Scope/);
    assert.match(
      markdown,
      /\[nx package health on npm-burst\]\(https:\/\/npm-burst.com\/package\/nx\/health\/\)/
    );
    assert.doesNotMatch(markdown, /```/);
    assert.doesNotMatch(markdown, /<https/);
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

describe('getSlackMessageJson', () => {
  it('emits a notification fallback and one mrkdwn section block per text section', () => {
    assert.deepEqual(getSlackMessageJson('Report title', ['one', 'two']), {
      text: 'Report title',
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: 'one' } },
        { type: 'section', text: { type: 'mrkdwn', text: 'two' } },
      ],
    });
  });
});
