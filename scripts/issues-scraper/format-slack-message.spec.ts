import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatGhReport,
  getSlackMessageJson,
  splitIntoBlocks,
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
    'scope: none': {
      ...stats(0),
      issues: { ...stats(0).issues, closed: 1 },
    },
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

describe('formatGhReport', () => {
  const sections = formatGhReport(current, trends, previous, links);
  const [header, issues, prs, footer] = sections;

  it('returns the header, issue table, PR table and footer as separate sections', () => {
    assert.equal(sections.length, 4);
    assert.match(header, /Aug 30 2026/);
    assert.match(
      header,
      /<https:\/\/example.com\/issues\|\[view unlabeled issues\]>/
    );
    assert.match(
      header,
      /<https:\/\/example.com\/prs\|\[view unlabeled PRs\]>/
    );
    assert.match(header, /Previous Report: Aug 23 2026/);
    assert.match(issues, /Issues.*Bugs.*Closed.*Avg Age.*P95 Age/);
    assert.match(prs, /Open.*Created.*Merged.*Closed.*Avg Age.*P95 Age/);
  });

  it('lists Everything, then Unscoped, then scopes by descending open count', () => {
    const rows = (table: string) =>
      table
        .split('\n')
        .filter((l) => l.startsWith('|'))
        .slice(2)
        .map((l) => l.split('|')[1].trim());
    const expected = ['Everything', 'Unscoped', 'scope: big', 'scope: small'];
    assert.deepEqual(rows(issues), [...expected, 'scope: none']);
    assert.deepEqual(rows(prs), expected);
  });

  it('renders counts with deltas and ages in days', () => {
    const issues = squash(sections[1]);
    const prs = squash(sections[2]);
    assert.match(
      issues,
      /\| Everything \| 9 \(\+1\) \| 9 \(\+1\) \| 9 \(\+1\) \| 90d \(\+1\) \| 180d \(\+1\) \|/
    );
    assert.match(
      issues,
      /\| Unscoped \| 2 \(-1\) \| 2 \(-1\) \| 2 \(-1\) \| 20d \(-1\) \| 40d \(-1\) \|/
    );
    assert.match(prs, /\| scope: small \| 1 \| 1 \| 1 \| 1 \| 3d \| 4d \|/);
  });

  it('shows a dash for ages when nothing is open', () => {
    const issues = squash(sections[1]);
    const prs = squash(sections[2]);
    assert.match(issues, /\| scope: none \| 0 \| 0 \| 1 \| - \| - \|/);
  });

  it('omits scope rows with no activity at all from a table', () => {
    assert.doesNotMatch(prs, /scope: none/);
  });

  it('links to the npm-burst package health page in the footer', () => {
    assert.match(
      footer,
      /<https:\/\/npm-burst.com\/package\/nx\/health\/\|[^>]+>/
    );
  });

  it('wraps every table section in a code fence', () => {
    for (const section of [issues, prs]) {
      assert.ok(section.startsWith('```\n'));
      assert.ok(section.endsWith('\n```'));
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

describe('getSlackMessageJson', () => {
  it('emits one mrkdwn section block per text section', () => {
    assert.deepEqual(getSlackMessageJson(['one', 'two']), {
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: 'one' } },
        { type: 'section', text: { type: 'mrkdwn', text: 'two' } },
      ],
    });
  });
});
