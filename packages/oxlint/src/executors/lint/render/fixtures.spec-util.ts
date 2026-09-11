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

/** A workspace holding the fixture source, for renderers that read files. */
export function createFixtureWorkspace(): string {
  const workspaceRoot = mkdtempSync(join(tmpdir(), 'oxlint-render-'));
  mkdirSync(join(workspaceRoot, 'libs/a/src'), { recursive: true });
  writeFileSync(join(workspaceRoot, 'libs/a/src/x.ts'), source);
  return workspaceRoot;
}
