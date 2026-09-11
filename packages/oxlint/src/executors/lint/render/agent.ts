import type { OxlintDiagnostic } from '../run-oxlint.js';
import { position } from './shared.js';

/** One line per diagnostic, matching Oxlint's own agent formatter. */
export function renderAgent(diagnostics: OxlintDiagnostic[]): string {
  return diagnostics
    .map((d) => {
      const { line, column } = position(d);
      const help = d.help ? ` help: ${d.help}` : '';
      return `${d.filename}:${line}:${column}: ${d.severity} ${d.code}: ${d.message}${help}\n`;
    })
    .join('');
}
