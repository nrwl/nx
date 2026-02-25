#!/usr/bin/env node
/**
 * One-time script to convert Next.js redirect rules to Netlify _redirects format.
 *
 * Usage: node nx-dev/nx-dev/scripts/generate-netlify-redirects.mjs
 *
 * Writes to nx-dev/nx-dev/_redirects
 */
import { createRequire } from 'module';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

const redirectRules = require('../redirect-rules.js');

/**
 * Expand regex-style groups in Next.js redirect sources.
 * e.g. "/(l|latest)/(a|angular)/foo" => ["/l/a/foo", "/l/angular/foo", "/latest/a/foo", "/latest/angular/foo"]
 */
function expandRegexGroups(pattern) {
  const groupRegex = /\(([^)]+)\)/;
  const match = pattern.match(groupRegex);
  if (!match) return [pattern];

  const alternatives = match[1].split('|');
  const results = [];
  for (const alt of alternatives) {
    const expanded = pattern.replace(match[0], alt);
    // Recursively expand remaining groups
    results.push(...expandRegexGroups(expanded));
  }
  return results;
}

/**
 * Convert a Next.js redirect source/destination pair to Netlify _redirects format.
 * Returns an array of lines (multiple if regex groups need expansion).
 */
function convertRule(source, destination) {
  const lines = [];

  // Expand regex groups in source
  const expandedSources = expandRegexGroups(source);

  for (let src of expandedSources) {
    let dest = destination;

    // Trim trailing whitespace from source (pageCleanUp has trailing spaces)
    src = src.trim();
    dest = dest.trim();

    // Convert Next.js :path* wildcard to Netlify * / :splat
    src = src.replace(/:path\*/g, '*');
    dest = dest.replace(/:path\*/g, ':splat');

    lines.push(`${src} ${dest} 301`);
  }

  return lines;
}

// Generate _redirects content
const outputLines = [
  '# Netlify _redirects file',
  '# Generated from redirect-rules.js and redirect-rules-docs-to-astro.js',
  '# All rules are permanent (301) redirects.',
  '#',
  '# Netlify processes these top-to-bottom, first match wins.',
  '# Specific rules MUST come before wildcard rules.',
  '',
];

for (const section of Object.keys(redirectRules)) {
  const rules = redirectRules[section];
  const entries = Object.entries(rules);
  if (entries.length === 0) continue;

  outputLines.push(`# --- ${section} ---`);

  for (const [source, destination] of entries) {
    const converted = convertRule(source, destination);
    for (const line of converted) {
      outputLines.push(line);
    }
  }

  outputLines.push('');
}

const outputPath = join(__dirname, '..', '_redirects');
const content = outputLines.join('\n');
writeFileSync(outputPath, content, 'utf-8');

// Count rules (non-empty, non-comment lines)
const ruleCount = content
  .split('\n')
  .filter((l) => l.trim() && !l.startsWith('#')).length;
console.log(`Wrote ${ruleCount} redirect rules to ${outputPath}`);
