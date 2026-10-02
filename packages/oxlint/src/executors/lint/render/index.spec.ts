import { renderDiagnostics } from './index';
import {
  createFixtureWorkspace,
  diagnostics,
  filelessDiagnostic,
  multilineDiagnostic,
  nonAsciiDiagnostics,
  nonAsciiSource,
} from './fixtures.spec-util';

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

  it('should place default underlines by UTF-8 byte columns the way Oxlint does', () => {
    expect(
      renderDiagnostics('default', nonAsciiDiagnostics, {
        workspaceRoot: createFixtureWorkspace(nonAsciiSource),
        agentMode: false,
      })
    ).toBe(
      "\n  × eslint(no-unused-vars): Variable 'olé' is declared but never used. Unused variables should start with a '_'.\n" +
        '   ╭─[libs/a/src/x.ts:1:7]\n' +
        ' 1 │ const olé = "😀"; debugger;\n' +
        '   ·       ─┬─\n' +
        "   ·        ╰── 'olé' is declared here\n" +
        ' 2 │ export {};\n' +
        '   ╰────\n' +
        '  help: Consider removing this declaration.\n' +
        '\n  × eslint(no-debugger): `debugger` statement is not allowed\n' +
        '   ╭─[libs/a/src/x.ts:1:22]\n' +
        ' 1 │ const olé = "😀"; debugger;\n' +
        '   ·                   ─────────\n' +
        ' 2 │ export {};\n' +
        '   ╰────\n' +
        '  help: Remove the debugger statement\n' +
        '\nFound 0 warnings and 2 errors.\n'
    );
  });

  it('should render default without a code frame for a diagnostic with no file or rule', () => {
    expect(
      renderDiagnostics('default', [filelessDiagnostic], {
        workspaceRoot,
        agentMode: false,
      })
    ).toBe(
      '\n  × There are suppressions that do not occur anymore.\n' +
        '  help: Run `oxlint --prune-suppressions` to remove unused suppressions.\n' +
        '\nFound 0 warnings and 1 error.\n'
    );
  });

  it('should indent the continuation lines of default text the way Oxlint does', () => {
    expect(
      renderDiagnostics('default', [multilineDiagnostic], {
        workspaceRoot,
        agentMode: false,
      })
    ).toBe(
      '\n  × probe(multi): First line.\n' +
        '  │ Second   line\n' +
        '  │     indented third.\n' +
        '   ╭─[libs/a/src/x.ts:1:1]\n' +
        ' 1 │ console.log(1);\n' +
        '   · ───────────\n' +
        ' 2 │ function f() { debugger; }\n' +
        '   ╰────\n' +
        '  help: Check the first.\n' +
        '        Then the second.\n' +
        '  note: These paths form a cycle:\n' +
        '           ╭──▶ ../b/y.js\n' +
        '\nFound 0 warnings and 1 error.\n'
    );
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

  it("should render json as the task's slice of the report", () => {
    expect(
      JSON.parse(
        renderDiagnostics('json', diagnostics, {
          workspaceRoot,
          agentMode: false,
        })
      )
    ).toEqual({ diagnostics });
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
