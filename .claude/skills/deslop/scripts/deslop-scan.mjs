#!/usr/bin/env node
/**
 * Scan prose for the tells that mark text as machine-written.
 *
 * The rules are not defined here. Punctuation comes from astro-docs/STYLE_GUIDE.md
 * and the phrase lists are read from the committed vale styles, so this and
 * `nx vale astro-docs` cannot disagree. Adding a banned phrase means editing the
 * vale style, and both surfaces pick it up.
 *
 *   node .claude/skills/deslop/scripts/deslop-scan.mjs <path|dir>...
 *   node .claude/skills/deslop/scripts/deslop-scan.mjs -        # read stdin
 *
 * Exit code is the error count, so CI can gate on it.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const STYLES = join(REPO, 'astro-docs/.vale/styles/Nx');
const TEXT = /\.(md|mdx|mdoc|txt)$/;

/** vale `existence` styles are a flat `tokens:` list; parse without a YAML dep. */
function valeTokens(file) {
  let raw;
  try {
    raw = readFileSync(join(STYLES, file), 'utf8');
  } catch {
    console.error(
      `warning: ${file} not found under astro-docs/.vale/styles/Nx.\n` +
        `  Phrase checks are skipped. If the styles moved, update this script rather than\n` +
        `  re-listing the phrases here, or the two surfaces will drift.`
    );
    return [];
  }
  const body = raw.slice(raw.indexOf('tokens:'));
  return [...body.matchAll(/^\s*-\s*['"]?(.+?)['"]?\s*$/gm)].map((m) => m[1]);
}

const PHRASES = [
  ...valeTokens('BannedPhrases.yml').map((t) => ({ t, why: 'AI-sounding phrase' })),
  ...valeTokens('MarketingLanguage.yml').map((t) => ({ t, why: 'marketing language' })),
];

// STYLE_GUIDE.md "Punctuation". Vale does not express these, and they are the
// loudest tells, so they are checked on every line and counted individually.
const PUNCT = [
  { re: /—/g, name: 'em dash', fix: 'Use a comma, a period, or parentheses. Not a colon, readers flag that swap too.' },
  { re: /–/g, name: 'en dash', fix: 'Use a comma, a period, or parentheses.' },
  { re: /;/g, name: 'semicolon', fix: 'Use two sentences.' },
];

function strip(text) {
  // Fenced blocks are examples, not prose. Blank them but keep line numbering.
  const lines = text.split('\n');
  let fenced = false;
  return lines.map((l) => {
    if (/^\s*(```|~~~)/.test(l)) {
      fenced = !fenced;
      return '';
    }
    return fenced ? '' : l;
  });
}

function scan(file, text) {
  const out = [];
  strip(text).forEach((line, i) => {
    if (!line.trim() || line.includes('deslop-ignore')) return;
    for (const { re, name, fix } of PUNCT) {
      const hits = line.match(re);
      if (hits) out.push({ file, line: i + 1, sev: 'error', name: `${name} (${hits.length})`, fix, text: line.trim() });
    }
    const prose = line.replace(/`[^`]*`/g, ' ').toLowerCase(); // a phrase inside a code span is fine
    // "delve into" appears in BannedPhrases and "delve" in MarketingLanguage.
    // Report the longest match only, or one tell inflates the count and the density.
    const hit = PHRASES.filter(({ t }) => prose.includes(t.toLowerCase())).sort((a, b) => b.t.length - a.t.length);
    const kept = [];
    for (const h of hit) {
      if (kept.some((k) => k.t.toLowerCase().includes(h.t.toLowerCase()))) continue;
      kept.push(h);
      out.push({ file, line: i + 1, sev: 'error', name: `${h.why}: "${h.t}"`, fix: 'Rewrite plainly.', text: line.trim() });
    }
  });
  return out;
}

function walk(p, acc = []) {
  const s = statSync(p);
  if (s.isDirectory()) {
    for (const e of readdirSync(p)) if (e !== 'node_modules' && !e.startsWith('.')) walk(join(p, e), acc);
  } else if (TEXT.test(p)) acc.push(p);
  return acc;
}

const args = process.argv.slice(2);
if (!args.length) {
  console.error('usage: deslop-scan.mjs <path|dir>...   |   deslop-scan.mjs -   (stdin)');
  process.exit(2);
}

let findings = [];
let words = 0;
if (args[0] === '-') {
  const text = readFileSync(0, 'utf8');
  words = text.split(/\s+/).filter(Boolean).length;
  findings = scan('<stdin>', text);
} else {
  for (const a of args.flatMap((a) => walk(a))) {
    const text = readFileSync(a, 'utf8');
    words += text.split(/\s+/).filter(Boolean).length;
    findings.push(...scan(relative(REPO, a) || a, text));
  }
}

for (const f of findings) {
  console.log(`${f.file}:${f.line}  ${f.name}`);
  console.log(`   ${f.text.slice(0, 100)}`);
  console.log(`   fix: ${f.fix}`);
}
const per1k = words ? ((findings.length / words) * 1000).toFixed(1) : '0.0';
console.log(
  `\n${findings.length} finding${findings.length === 1 ? '' : 's'} over ${words} words (${per1k}/1k).`
);
if (!findings.length) {
  console.log('Mechanical tells are clean. The structural ones are in REFERENCE.md and need your eyes.');
}
process.exit(Math.min(findings.length, 250));
