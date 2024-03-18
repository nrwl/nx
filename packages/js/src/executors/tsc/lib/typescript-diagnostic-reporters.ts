import * as ts from 'typescript';

// adapted from TS default diagnostic reporter
export function formatDiagnosticReport(
  diagnostic: ts.Diagnostic,
  host: ts.FormatDiagnosticsHost
): string {
  const diagnostics: ts.Diagnostic[] = new Array(1);
  diagnostics[0] = diagnostic;
  const formattedDiagnostic =
    '\n' +
    ts.formatDiagnosticsWithColorAndContext(diagnostics, host) +
    host.getNewLine();
  diagnostics[0] = undefined;

  return formattedDiagnostic;
}

// adapted from TS default solution builder status reporter
export function formatSolutionBuilderStatusReport(
  diagnostic: ts.Diagnostic
): string {
  let formattedDiagnostic = `[${formatColorAndReset(
    getLocaleTimeString(),
    ForegroundColorEscapeSequences.Grey
  )}] `;
  formattedDiagnostic += `${ts.flattenDiagnosticMessageText(
    diagnostic.messageText,
    ts.sys.newLine
  )}${ts.sys.newLine + ts.sys.newLine}`;

  return formattedDiagnostic;
}

function formatColorAndReset(text: string, formatStyle: string) {
  const resetEscapeSequence = '\u001b[0m';
  return formatStyle + text + resetEscapeSequence;
}

function getLocaleTimeString() {
  return new Date().toLocaleTimeString();
}

enum ForegroundColorEscapeSequences {
  Grey = '\u001b[90m',
  Red = '\u001b[91m',
  Yellow = '\u001b[93m',
  Blue = '\u001b[94m',
  Cyan = '\u001b[96m',
}
