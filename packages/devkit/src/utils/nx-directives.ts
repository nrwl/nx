const DIRECTIVE = /^@nx-([\w-]+):(.*)$/;

/**
 * The `@nx-<name>: <value>` directives in the comment block that opens a file,
 * by name, with their trimmed values in order. Reading stops at the first line
 * that is not blank, a shebang or a comment.
 */
export function parseNxDirectives(content: string): Map<string, string[]> {
  const directives = new Map<string, string[]>();
  let inBlock = false;
  let start = 0;
  while (start < content.length) {
    const newline = content.indexOf('\n', start);
    const end = newline === -1 ? content.length : newline;
    let line = content.slice(start, end).trim();
    start = end + 1;
    if (!inBlock) {
      if (line === '' || line.startsWith('#!')) {
        continue;
      }
      if (line.startsWith('//')) {
        line = line.slice(2);
      } else if (line.startsWith('/*')) {
        inBlock = true;
        line = line.slice(2);
      } else {
        break;
      }
    }
    if (inBlock) {
      const blockEnd = line.indexOf('*/');
      if (blockEnd !== -1) {
        inBlock = false;
        // Code after `*/` means the block is not a file header.
        if (line.slice(blockEnd + 2).trim() !== '') {
          break;
        }
        line = line.slice(0, blockEnd);
      }
      line = line.replace(/^\s*\*+/, '');
    }
    const match = line.trim().match(DIRECTIVE);
    if (match) {
      const [, name, value] = match;
      const values = directives.get(name);
      if (values) {
        values.push(value.trim());
      } else {
        directives.set(name, [value.trim()]);
      }
    }
  }
  return directives;
}
