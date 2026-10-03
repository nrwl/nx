import { renderGithub } from './github';
import {
  createFixtureWorkspace,
  diagnostics,
  filelessDiagnostic,
  nonAsciiDiagnostics,
  nonAsciiSource,
} from './fixtures.spec-util';

describe('renderGithub', () => {
  it('should render workflow commands with end positions from the source', () => {
    const workspaceRoot = createFixtureWorkspace();
    expect(renderGithub(diagnostics, workspaceRoot)).toBe(
      "::error file=libs/a/src/x.ts,line=2,endLine=2,col=10,endColumn=11,title=eslint(no-unused-vars)::libs/a/src/x.ts:2:10: Function 'f' is declared but never used.\n" +
        '::warning file=libs/a/src/x.ts,line=1,endLine=1,col=1,endColumn=12,title=eslint(no-console)::libs/a/src/x.ts:1:1: Unexpected console statement.\n'
    );
  });

  it('should count end positions in UTF-8 bytes the way Oxlint does', () => {
    const workspaceRoot = createFixtureWorkspace(nonAsciiSource);
    expect(renderGithub([nonAsciiDiagnostics[1]], workspaceRoot)).toBe(
      '::error file=libs/a/src/x.ts,line=1,endLine=1,col=22,endColumn=31,title=eslint(no-debugger)::libs/a/src/x.ts:1:22: `debugger` statement is not allowed\n'
    );
  });

  it('should put an end that follows a newline on the next line the way Oxlint does', () => {
    // Captured from `oxlint --format=json` 1.77.0 on this source.
    const workspaceRoot = createFixtureWorkspace('const x =\n');
    expect(
      renderGithub(
        [
          {
            message: 'Unexpected token',
            severity: 'error',
            filename: 'libs/a/src/x.ts',
            labels: [{ span: { offset: 10, length: 0, line: 2, column: 1 } }],
          },
        ],
        workspaceRoot
      )
    ).toBe(
      '::error file=libs/a/src/x.ts,line=2,endLine=2,col=1,endColumn=1,title=oxlint::libs/a/src/x.ts:2:1: Unexpected token\n'
    );
  });

  it('should render a diagnostic with no file or rule the way Oxlint does', () => {
    expect(renderGithub([filelessDiagnostic], '/ws')).toBe(
      '::error title=oxlint::There are suppressions that do not occur anymore.\n'
    );
  });
});
