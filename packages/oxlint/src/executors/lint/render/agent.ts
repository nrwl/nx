import type { OxlintDiagnostic } from '../run-oxlint.js';
import { position } from './shared.js';

/** One line per diagnostic, matching Oxlint's own agent formatter. */
export function renderAgent(diagnostics: OxlintDiagnostic[]): string {
  return diagnostics
    .map((d) => {
      const { line, column } = position(d);
      const location = d.filename
        ? `${d.filename}:${line}:${column}`
        : '<unknown>';
      const code = d.code ? ` ${d.code}` : '';
      const help = d.help ? ` help: ${compact(d.help)}` : '';
      return `${location}: ${d.severity}${code}: ${compact(d.message)}${help}\n`;
    })
    .join('');
}

function compact(text: string): string {
  return text.split(/\s+/).filter(Boolean).join(' ');
}
