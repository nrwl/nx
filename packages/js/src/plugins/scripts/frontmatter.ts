import { load } from '@zkochan/js-yaml';
import { stripBom } from './shebang';

export type Frontmatter = Record<string, unknown>;

/**
 * Reads the YAML in a `/** @nx ... *\/` block comment after the shebang. Any other
 * first comment yields `{}`. Throws on malformed YAML or an unterminated `@nx` block.
 */
export function parseFrontmatter(source: string): Frontmatter {
  const lines = stripBom(source).split(/\r?\n/);
  // lines[0] is the shebang; blank lines may follow it.
  let start = 1;
  while (start < lines.length && !lines[start].trim()) {
    start++;
  }
  if (!lines[start]?.trim().startsWith('/*')) {
    return {};
  }

  const block: string[] = [];
  let terminated = false;
  for (let i = start; i < lines.length; i++) {
    let line = i === start ? lines[i].trim().replace(/^\/\*\*?/, '') : lines[i];
    const end = line.indexOf('*/');
    if (end !== -1) {
      line = line.slice(0, end);
      terminated = true;
    }
    // Tolerate JSDoc-style ` * ` line prefixes.
    block.push(line.replace(/^\s*\* ?/, ''));
    if (terminated) {
      break;
    }
  }

  const firstContent = block.findIndex((line) => line.trim());
  const marker = (block[firstContent] ?? '').match(/^\s*@nx(?=\s|$)(.*)$/);
  if (!marker) {
    return {};
  }
  if (!terminated) {
    throw new Error('Unterminated "@nx" frontmatter block.');
  }

  const body = [marker[1].trim(), ...block.slice(firstContent + 1)];
  const parsed = load(body.join('\n'));
  if (parsed == null) {
    return {};
  }
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('The "@nx" frontmatter block must be a YAML mapping.');
  }
  return parsed as Frontmatter;
}
