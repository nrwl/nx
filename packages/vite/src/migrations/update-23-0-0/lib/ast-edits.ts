import type { Node } from 'typescript';

export interface TextEdit {
  start: number;
  end: number;
  replacement: string;
}

/**
 * Apply a list of non-overlapping edits to `contents`. Edits are sorted by
 * `start` descending so positions stay valid as text is spliced.
 */
export function applyTextEdits(contents: string, edits: TextEdit[]): string {
  if (edits.length === 0) return contents;
  const sorted = [...edits].sort((a, b) => b.start - a.start);
  let updated = contents;
  for (const edit of sorted) {
    updated =
      updated.slice(0, edit.start) + edit.replacement + updated.slice(edit.end);
  }
  return updated;
}

/**
 * Edit that removes `node` and a single trailing comma if present. Designed
 * for removing a `PropertyAssignment` from an object literal without leaving
 * a dangling separator.
 */
export function removeNodeWithTrailingCommaEdit(
  contents: string,
  node: Node
): TextEdit {
  const start = node.getStart();
  let end = node.getEnd();
  if (contents[end] === ',') end++;
  return { start, end, replacement: '' };
}

/**
 * Edit that replaces the textual range of `node` with `replacement`.
 */
export function replaceNodeTextEdit(node: Node, replacement: string): TextEdit {
  return { start: node.getStart(), end: node.getEnd(), replacement };
}

/**
 * Edit that replaces a string literal's content while preserving the user's
 * original quote style. `node` is expected to be a StringLiteral.
 */
export function replaceStringLiteralValueEdit(
  contents: string,
  node: Node,
  newValue: string
): TextEdit {
  const start = node.getStart();
  const end = node.getEnd();
  const quote = contents[start]; // ' or "
  return { start, end, replacement: `${quote}${newValue}${quote}` };
}
