import type { ReferenceHeading, ReferenceProse, ReferenceTable } from './types';

export function prose(markdown: string): ReferenceProse {
  return { markdown, html: '' };
}

export function referenceTable(
  columns: string[],
  rows: string[][]
): ReferenceTable {
  return { columns, rows: rows.map((row) => row.map(prose)) };
}

function cell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function table(headers: string[], rows: string[][]): string {
  if (!rows.length) return '';
  return [headers, headers.map(() => '---'), ...rows]
    .map((row) => `| ${row.map(cell).join(' | ')} |`)
    .join('\n');
}

export function code(value: unknown): string {
  const source = String(value);
  const fence = '`'.repeat(
    Math.max(
      1,
      ...[...source.matchAll(/`+/g)].map((match) => match[0].length + 1)
    )
  );
  const pad =
    source.startsWith('`') ||
    source.endsWith('`') ||
    (source.startsWith(' ') && source.endsWith(' ') && /\S/.test(source))
      ? ' '
      : '';
  return `${fence}${pad}${source}${pad}${fence}`;
}

export function anchor(id: string): string {
  return `<a id="${id.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}"></a>`;
}

export function tableMarkdown(value: ReferenceTable): string {
  return table(
    value.columns,
    value.rows.map((row) => row.map((cell) => cell.markdown))
  );
}

export function headingMarkdown(value: ReferenceHeading): string {
  return `${anchor(value.slug)}\n\n${'#'.repeat(value.depth)} ${value.text}`;
}

export function fencedCode(value: string, language = 'json'): string {
  const fence = '`'.repeat(
    Math.max(
      3,
      ...[...value.matchAll(/`+/g)].map((match) => match[0].length + 1)
    )
  );
  return `${fence}${language}\n${value}\n${fence}`;
}
