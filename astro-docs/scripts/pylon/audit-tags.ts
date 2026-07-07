/**
 * Tag census for knowledge-base articles that are candidates for migration
 * to the Pylon KB. Reports which custom Markdoc tags each article uses and
 * flags tags with no static-HTML equivalent (interactive components), so a
 * human can decide screenshot-vs-keep before adding an article to
 * migration-list.json.
 *
 * Usage: tsx scripts/pylon/audit-tags.ts
 */
import Markdoc from '@markdoc/markdoc';
import fs from 'node:fs';
import path from 'node:path';
import { CANDIDATE_DIRS, CONTENT_DOCS_ROOT } from './config';

// Tags markdoc-to-html.ts can (or will) convert to plain HTML.
const CONVERTIBLE_TAGS = new Set([
  'aside',
  'callout',
  'youtube',
  'tabs',
  'tabitem',
  'filetree',
  'llm_copy_prompt',
]);

// Interactive components with no static HTML equivalent.
const INTERACTIVE_TAGS = new Set([
  'graph',
  'project_details',
  'video_player',
  'course_video',
]);

// Navigation tags only used on section index pages, which are not migrated.
const INDEX_PAGE_TAGS = new Set([
  'index_page_cards',
  'sidebar_group_cards',
  'cards',
  'card',
  'call_to_action',
  'link_button',
]);

interface ArticleAudit {
  file: string;
  isIndex: boolean;
  tagCounts: Map<string, number>;
}

function auditFile(filePath: string): ArticleAudit {
  const source = fs.readFileSync(filePath, 'utf-8');
  const ast = Markdoc.parse(source);
  const tagCounts = new Map<string, number>();
  for (const node of ast.walk()) {
    if (node.type === 'tag' && node.tag) {
      tagCounts.set(node.tag, (tagCounts.get(node.tag) ?? 0) + 1);
    }
  }
  return {
    file: path.relative(CONTENT_DOCS_ROOT, filePath),
    isIndex: path.basename(filePath) === 'index.mdoc',
    tagCounts,
  };
}

function classify(tag: string): string {
  if (INTERACTIVE_TAGS.has(tag)) return 'INTERACTIVE';
  if (CONVERTIBLE_TAGS.has(tag)) return 'ok';
  if (INDEX_PAGE_TAGS.has(tag)) return 'index-only';
  return 'UNHANDLED';
}

const audits: ArticleAudit[] = [];
for (const dir of CANDIDATE_DIRS) {
  for (const entry of fs.readdirSync(dir).sort()) {
    if (entry.endsWith('.mdoc')) {
      audits.push(auditFile(path.join(dir, entry)));
    }
  }
}

const lines: string[] = [];
lines.push('# Pylon migration tag audit');
lines.push('');
lines.push('| Article | Tags used | Flags |');
lines.push('|---|---|---|');

const totals = new Map<string, number>();
for (const audit of audits) {
  const tagSummary =
    [...audit.tagCounts.entries()]
      .map(([tag, count]) => `\`${tag}\`×${count}`)
      .join(', ') || '(none)';
  const flags = new Set<string>();
  for (const [tag, count] of audit.tagCounts) {
    totals.set(tag, (totals.get(tag) ?? 0) + count);
    const kind = classify(tag);
    if (kind === 'INTERACTIVE') flags.add(`⚠️ interactive: \`${tag}\``);
    if (kind === 'UNHANDLED') flags.add(`❌ no transform: \`${tag}\``);
  }
  if (audit.isIndex) flags.add('index page (not migrated)');
  lines.push(
    `| ${audit.file} | ${tagSummary} | ${[...flags].join('; ') || '✅ convertible'} |`
  );
}

lines.push('');
lines.push('## Tag totals across all candidates');
lines.push('');
lines.push('| Tag | Occurrences | Classification |');
lines.push('|---|---|---|');
for (const [tag, count] of [...totals.entries()].sort((a, b) => b[1] - a[1])) {
  lines.push(`| \`${tag}\` | ${count} | ${classify(tag)} |`);
}

console.log(lines.join('\n'));
