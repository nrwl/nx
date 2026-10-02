import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { OxlintDiagnostic } from '../run-oxlint.js';

// Captured from `oxlint --format=json` 1.77.0 on this source.
export const source = 'console.log(1);\nfunction f() { debugger; }\n';

export const diagnostics: OxlintDiagnostic[] = [
  {
    message: "Function 'f' is declared but never used.",
    code: 'eslint(no-unused-vars)',
    severity: 'error',
    filename: 'libs/a/src/x.ts',
    labels: [
      {
        label: "'f' is declared here",
        span: { offset: 25, length: 1, line: 2, column: 10 },
      },
    ],
    help: 'Consider removing this declaration.',
    url: 'https://oxc.rs/docs/guide/usage/linter/rules/eslint/no-unused-vars.html',
  },
  {
    message: 'Unexpected console statement.',
    code: 'eslint(no-console)',
    severity: 'warning',
    filename: 'libs/a/src/x.ts',
    labels: [{ span: { offset: 0, length: 11, line: 1, column: 1 } }],
    help: 'Delete this console statement.',
  },
];

// Captured from `oxlint --format=json` 1.77.0 with a stale suppressions file.
export const filelessDiagnostic: OxlintDiagnostic = {
  message: 'There are suppressions that do not occur anymore.',
  severity: 'error',
  filename: '',
  labels: [],
  help: 'Run `oxlint --prune-suppressions` to remove unused suppressions.',
};

// The message is a JS plugin rule's, captured from Oxlint 1.77.0; the help
// and note span lines the same way.
export const multilineDiagnostic: OxlintDiagnostic = {
  message: 'First line.\nSecond   line\n    indented third.',
  code: 'probe(multi)',
  severity: 'error',
  filename: 'libs/a/src/x.ts',
  labels: [{ span: { offset: 0, length: 11, line: 1, column: 1 } }],
  help: 'Check the first.\nThen the second.',
  note: 'These paths form a cycle:\n╭──▶ ../b/y.js',
};

// Captured from `oxlint --format=json` 1.77.0 on this source.
export const nonAsciiSource = 'const olé = "😀"; debugger;\nexport {};\n';

export const nonAsciiDiagnostics: OxlintDiagnostic[] = [
  {
    message:
      "Variable 'olé' is declared but never used. Unused variables should start with a '_'.",
    code: 'eslint(no-unused-vars)',
    severity: 'error',
    filename: 'libs/a/src/x.ts',
    labels: [
      {
        label: "'olé' is declared here",
        span: { offset: 6, length: 4, line: 1, column: 7 },
      },
    ],
    help: 'Consider removing this declaration.',
  },
  {
    message: '`debugger` statement is not allowed',
    code: 'eslint(no-debugger)',
    severity: 'error',
    filename: 'libs/a/src/x.ts',
    labels: [{ span: { offset: 21, length: 9, line: 1, column: 22 } }],
    help: 'Remove the debugger statement',
  },
];

/** A workspace holding the fixture source, for renderers that read files. */
export function createFixtureWorkspace(contents = source): string {
  const workspaceRoot = mkdtempSync(join(tmpdir(), 'oxlint-render-'));
  mkdirSync(join(workspaceRoot, 'libs/a/src'), { recursive: true });
  writeFileSync(join(workspaceRoot, 'libs/a/src/x.ts'), contents);
  return workspaceRoot;
}
