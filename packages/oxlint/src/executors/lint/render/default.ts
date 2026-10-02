import pc from 'picocolors';
import type { OxlintDiagnostic, OxlintSpan } from '../run-oxlint.js';
import { position, SourceCache, type RenderContext } from './shared.js';

/**
 * Oxlint's terminal report: a code frame per diagnostic with a file, with one
 * line of context either side, the span underlined, and the label, `help` and
 * `note` text below. Source lines come from disk since the JSON report carries
 * no source text, so a run with no diagnostics reads nothing.
 */
export function renderGraphical(
  diagnostics: OxlintDiagnostic[],
  context: RenderContext
): string {
  const sources = new SourceCache(context.workspaceRoot);
  let out = '';
  for (const d of diagnostics) {
    const isError = d.severity === 'error';
    const paint = isError ? pc.red : pc.yellow;
    const { line, column } = position(d);
    const code = d.code ? `${paint(d.code)}: ` : '';
    out += `\n  ${paint(isError ? '×' : '⚠')} ${code}${indent(d.message, `  ${paint('│')} `)}\n`;
    if (d.filename) {
      out += `   ${pc.dim(`╭─[${d.filename}:${line}:${column}]`)}\n`;

      const lines = sources.lines(d.filename);
      const span = d.labels[0]?.span;
      if (lines && span) {
        // Oxlint shows no line for the empty string after a final newline.
        const lineCount = lines.at(-1) === '' ? lines.length - 1 : lines.length;
        const first = Math.max(1, line - 1);
        const last = Math.min(lineCount, line + 1);
        const width = String(last).length;
        for (let n = first; n <= last; n++) {
          const text = lines[n - 1];
          out += ` ${pc.dim(String(n).padStart(width))} ${pc.dim('│')}${text ? ` ${text}` : ''}\n`;
          if (n === line) {
            out += underline(
              width,
              column,
              span,
              lines[n - 1],
              d.labels[0].label,
              paint
            );
          }
        }
      }
      out += `   ${pc.dim('╰────')}\n`;
    }
    if (d.help) {
      out += `  ${pc.cyan('help')}: ${indent(d.help, ' '.repeat(8))}\n`;
    }
    if (d.note) {
      out += `  ${pc.cyan('note')}: ${indent(d.note, ' '.repeat(11))}\n`;
    }
  }
  return out;
}

function indent(text: string, prefix: string): string {
  return text.replaceAll('\n', `\n${prefix}`);
}

function underline(
  width: number,
  column: number,
  span: OxlintSpan,
  lineText: string,
  label: string | undefined,
  paint: (s: string) => string
): string {
  const bytes = Buffer.from(lineText);
  // A multi-line span is underlined to the end of its first line.
  const length = Math.max(
    1,
    bytes.subarray(column - 1, column - 1 + span.length).toString().length
  );
  const gutter = ` ${' '.repeat(width)} ${pc.dim('·')} `;
  const pad = ' '.repeat(bytes.subarray(0, column - 1).toString().length);
  if (!label) {
    return `${gutter}${pad}${paint('─'.repeat(length))}\n`;
  }
  const mid = Math.floor((length - 1) / 2);
  const bar = '─'.repeat(mid) + '┬' + '─'.repeat(length - mid - 1);
  return (
    `${gutter}${pad}${paint(bar)}\n` +
    `${gutter}${pad}${' '.repeat(mid)}${paint('╰── ' + label)}\n`
  );
}
