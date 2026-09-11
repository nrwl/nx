import { renderGithub } from './github';
import { createFixtureWorkspace, diagnostics } from './fixtures.spec-util';

describe('renderGithub', () => {
  it('should render workflow commands with end positions from the source', () => {
    const workspaceRoot = createFixtureWorkspace();
    expect(renderGithub(diagnostics, { workspaceRoot, agentMode: false })).toBe(
      "::error file=libs/a/src/x.ts,line=2,endLine=2,col=10,endColumn=11,title=eslint(no-unused-vars)::libs/a/src/x.ts:2:10: Function 'f' is declared but never used.\n" +
        '::warning file=libs/a/src/x.ts,line=1,endLine=1,col=1,endColumn=12,title=eslint(no-console)::libs/a/src/x.ts:1:1: Unexpected console statement.\n'
    );
  });
});
