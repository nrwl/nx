import { renderDiagnostics } from './index';
import { createFixtureWorkspace, diagnostics } from './fixtures.spec-util';

// picocolors decides on colors at import time, so an env var set in the test is too late.
vi.mock('picocolors', async () => {
  const colors = (await vi.importActual<any>('picocolors')).createColors(false);
  return { __esModule: true, default: colors, ...colors };
});

describe('renderDiagnostics', () => {
  let workspaceRoot: string;
  beforeAll(() => {
    workspaceRoot = createFixtureWorkspace();
  });

  it('should render default as code frames with the label and help text', () => {
    const out = renderDiagnostics('default', diagnostics, {
      workspaceRoot,
      agentMode: false,
    });
    expect(out).toMatchInlineSnapshot(`
      "
        × eslint(no-unused-vars): Function 'f' is declared but never used.
         ╭─[libs/a/src/x.ts:2:10]
       1 │ console.log(1);
       2 │ function f() { debugger; }
         ·          ┬
         ·          ╰── 'f' is declared here
       3 │
         ╰────
        help: Consider removing this declaration.

        ⚠ eslint(no-console): Unexpected console statement.
         ╭─[libs/a/src/x.ts:1:1]
       1 │ console.log(1);
         · ───────────
       2 │ function f() { debugger; }
         ╰────
        help: Delete this console statement.

      Found 1 warning and 1 error.
      "
    `);
  });

  it('should render default as agent one-liners in agent mode', () => {
    expect(
      renderDiagnostics('default', diagnostics, {
        workspaceRoot,
        agentMode: true,
      })
    ).toBe(
      "libs/a/src/x.ts:2:10: error eslint(no-unused-vars): Function 'f' is declared but never used. help: Consider removing this declaration.\n" +
        'libs/a/src/x.ts:1:1: warning eslint(no-console): Unexpected console statement. help: Delete this console statement.\n'
    );
  });

  it('should append the summary to github output', () => {
    expect(
      renderDiagnostics('github', diagnostics, {
        workspaceRoot,
        agentMode: false,
      })
    ).toContain('\nFound 1 warning and 1 error.\n');
  });

  it('should render only the summary for a clean default run', () => {
    expect(
      renderDiagnostics('default', [], { workspaceRoot, agentMode: false })
    ).toBe('Found 0 warnings and 0 errors.\n');
    expect(
      renderDiagnostics('agent', [], { workspaceRoot, agentMode: true })
    ).toBe('');
  });
});
