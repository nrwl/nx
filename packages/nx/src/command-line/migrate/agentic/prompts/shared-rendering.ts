import type { FileChange } from '../../../../generators/tree';

export function renderFileEntry(change: FileChange): string {
  return `[${change.type}] ${change.path}`;
}

// 2-space continuation indent on lines 2+ so multi-line entries parse as a
// single markdown list item rather than introducing a new prose paragraph.
export function renderListItem(entry: string): string {
  const [first, ...rest] = entry.split('\n');
  return [`- ${first}`, ...rest.map((line) => `  ${line}`)].join('\n');
}

// YAML block-scalar form (`key: |`) for multi-line values inside `<migration>`,
// so embedded newlines don't break the inner block's visual grouping.
export function renderKeyMultilineValue(key: string, value: string): string[] {
  const valueLines = value.split('\n');
  if (valueLines.length === 1) {
    return [`${key}: ${value}`];
  }
  return [`${key}: |`, ...valueLines.map((line) => `  ${line}`)];
}

// picocolors emits `\x1b[Nm` sequences; the regex catches simple SGR codes
// and any extended CSI sequence terminating in a letter.
const ANSI_RE = /\x1b\[[0-9;]*[a-zA-Z]/g;
export function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, '');
}
