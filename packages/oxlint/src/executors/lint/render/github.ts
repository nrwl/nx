import type { OxlintDiagnostic } from '../run-oxlint.js';
import { position, SourceCache, type RenderContext } from './shared.js';

/**
 * GitHub Actions workflow commands, one annotation per diagnostic
 * (https://docs.github.com/en/actions/reference/workflow-commands-for-github-actions).
 */
export function renderGithub(
  diagnostics: OxlintDiagnostic[],
  context: RenderContext
): string {
  const sources = new SourceCache(context.workspaceRoot);
  return diagnostics
    .map((d) => {
      const span = d.labels[0]?.span;
      const { line, column } = position(d);
      const end = span ? sources.endOf(d.filename, span) : { line, column };
      const level = d.severity === 'error' ? 'error' : 'warning';
      const props = [
        `file=${escapeProperty(d.filename)}`,
        `line=${line}`,
        `endLine=${end.line}`,
        `col=${column}`,
        `endColumn=${end.column}`,
        `title=${escapeProperty(d.code)}`,
      ].join(',');
      const message = escapeData(
        `${d.filename}:${line}:${column}: ${d.message}`
      );
      return `::${level} ${props}::${message}\n`;
    })
    .join('');
}

// https://github.com/actions/toolkit/blob/main/packages/core/src/command.ts
function escapeData(s: string): string {
  return s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

function escapeProperty(s: string): string {
  return escapeData(s).replace(/:/g, '%3A').replace(/,/g, '%2C');
}
