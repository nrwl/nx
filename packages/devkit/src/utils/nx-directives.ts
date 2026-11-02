const DIRECTIVE = /^@nx-([\w-]+)(?::(.*))?$/;

/** The `@nx-<name>` directives Nx reads. */
export const NX_DIRECTIVE_NAMES = [
  'depends-on',
  'ignore-server-inputs',
  'target-name',
] as const;

export interface NxDirectiveHeaderLine {
  /** The line without its comment markers, trimmed. */
  text: string;
  /** Where `text` starts in the file content. */
  start: number;
}

/**
 * The lines of the comment block that opens a file, without their comment
 * markers, and where the block ends. Reading stops at the first line that is
 * not blank, a shebang or a comment.
 */
export function readNxDirectiveHeader(content: string): {
  lines: NxDirectiveHeaderLine[];
  end: number;
} {
  const lines: NxDirectiveHeaderLine[] = [];
  let inBlock = false;
  let start = 0;
  while (start < content.length) {
    const lineStart = start;
    const newline = content.indexOf('\n', start);
    const lineEnd = newline === -1 ? content.length : newline;
    const raw = content.slice(lineStart, lineEnd);
    start = lineEnd + 1;
    let line = raw.trim();
    let offset = lineStart + raw.length - raw.trimStart().length;
    if (!inBlock) {
      if (line === '' || line.startsWith('#!')) {
        continue;
      }
      if (line.startsWith('//')) {
        line = line.slice(2);
        offset += 2;
      } else if (line.startsWith('/*')) {
        inBlock = true;
        line = line.slice(2);
        offset += 2;
      } else {
        return { lines, end: lineStart };
      }
    }
    if (inBlock) {
      const blockEnd = line.indexOf('*/');
      if (blockEnd !== -1) {
        inBlock = false;
        // Code after `*/` ends the header before this line.
        if (line.slice(blockEnd + 2).trim() !== '') {
          return { lines, end: lineStart };
        }
        line = line.slice(0, blockEnd);
      }
      const marker = line.match(/^\s*\*+/)?.[0].length ?? 0;
      line = line.slice(marker);
      offset += marker;
    }
    offset += line.length - line.trimStart().length;
    lines.push({ text: line.trim(), start: offset });
  }
  return { lines, end: content.length };
}

/**
 * The name and trimmed value of a `@nx-<name>: <value>` directive line. A bare
 * `@nx-<name>` has the value `''`.
 */
export function matchNxDirective(
  text: string
): { name: string; value: string } | undefined {
  const match = text.match(DIRECTIVE);
  return match ? { name: match[1], value: (match[2] ?? '').trim() } : undefined;
}

/**
 * The `@nx-<name>: <value>` directives in the comment block that opens a file,
 * by name, with their trimmed values in order. A bare `@nx-<name>` has the
 * value `''`.
 */
export function parseNxDirectives(content: string): Map<string, string[]> {
  const directives = new Map<string, string[]>();
  for (const { text } of readNxDirectiveHeader(content).lines) {
    const directive = matchNxDirective(text);
    if (!directive) {
      continue;
    }
    const values = directives.get(directive.name);
    if (values) {
      values.push(directive.value);
    } else {
      directives.set(directive.name, [directive.value]);
    }
  }
  return directives;
}
