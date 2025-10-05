import {
  cleanupProject,
  newProject,
  readFile,
  runCLI,
  updateFile,
} from '@nx/e2e-utils';

describe('configure-ai-agents', () => {
  beforeAll(() => newProject({ packages: ['@nx/web', '@nx/js', '@nx/react'] }));
  afterAll(() => cleanupProject());

  it('should generate local configuration', () => {
    runCLI(`configure-ai-agents --agents claude --no-interactive`);

    expect(readFile('CLAUDE.md')).toContain('# General Guidelines');
    expect(readFile('.mcp.json')).toContain('nx-mcp');
  });

  it('should do nothing if agent is already configured', () => {
    const output = runCLI(
      `configure-ai-agents --agents claude --no-interactive`
    );

    expect(output).toContain('All selected AI agents are already configured');
  });

  it('should throw with --check if agent rules are out of date', () => {
    updateFile('CLAUDE.md', (content: string) =>
      content.replace('nx_workspace', 'nx_workspace_outdated')
    );

    let didThrow = false;
    try {
      runCLI(`configure-ai-agents --agents claude --check`);
    } catch {
      didThrow = true;
    }
    expect(didThrow).toBe(true);
  });

  it('should update agent rules if out of date', () => {
    runCLI(`configure-ai-agents --agents claude --no-interactive`);

    expect(readFile('CLAUDE.md')).not.toContain('nx_workspace_outdated');
  });
});
