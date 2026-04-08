export function termSize(): { cols: number; rows: number } {
  return {
    cols: process.stdout.columns || 80,
    rows: process.stdout.rows || 24,
  };
}

export function truncateEnd(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}

export const centerStringInWidth = (str: string, width: number): string => {
  const padding = Math.max(0, width - str.length);
  const padStart = Math.floor(padding / 2);
  const padEnd = padding - padStart;
  return ' '.repeat(padStart) + str + ' '.repeat(padEnd);
};

export function asciiBlock(
  w: number,
  px: number,
  py: number,
  text: string
): string[] {
  const lines = text.split('\n');
  const contentWidth = w - px * 2 - 2;
  const paddedLines = lines.map((line) => {
    const truncatedLine =
      line.length > contentWidth
        ? line.slice(0, contentWidth - 3) + '...'
        : line;
    return centerStringInWidth(truncatedLine, w - 2);
  });
  const emptyLine = ' '.repeat(w - 2);
  const blockLines = [
    '┌' + '─'.repeat(w - 2) + '┐',
    ...Array(py).fill('│' + emptyLine + '│'),
    ...paddedLines.map((line) => '│' + line + '│'),
    ...Array(py).fill('│' + emptyLine + '│'),
    '└' + '─'.repeat(w - 2) + '┘',
  ];
  return blockLines;
}
