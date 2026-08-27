import type { OxlintDiagnostic } from '../run-oxlint.js';

/** The task's slice of Oxlint's own JSON report. */
export function renderJson(diagnostics: OxlintDiagnostic[]): string {
  return JSON.stringify({ diagnostics }, null, 2) + '\n';
}
