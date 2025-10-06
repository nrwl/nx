import {
  cleanupProject,
  newProject,
  readFile,
  removeFile,
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

  describe('--check (backward compatible, defaults to outdated mode)', () => {
    beforeAll(() => {
      // Clean up previous tests
      removeFile('CLAUDE.md');
      removeFile('.mcp.json');
    });

    it('should exit 0 with no configured agents', () => {
      const output = runCLI(`configure-ai-agents --agents claude --check`);
      expect(output).toContain('No AI agents are configured');
    });

    it('should exit 0 with up-to-date agents', () => {
      runCLI(`configure-ai-agents --agents claude --no-interactive`);

      const output = runCLI(`configure-ai-agents --agents claude --check`);
      expect(output).toContain('All configured AI agents are up to date');
    });
  });

  describe('--check=outdated (explicit outdated mode)', () => {
    it('should exit 0 with no configured agents', () => {
      removeFile('CLAUDE.md');
      removeFile('.mcp.json');

      const output = runCLI(
        `configure-ai-agents --agents claude --check=outdated`
      );
      expect(output).toContain('No AI agents are configured');
    });

    it('should exit 0 with partially configured agents (ignores partial configs)', () => {
      runCLI(`configure-ai-agents --agents claude --no-interactive`);
      removeFile('.mcp.json');

      const output = runCLI(
        `configure-ai-agents --agents claude --check=outdated`
      );
      // Should exit 0 because partially configured agents are ignored in outdated mode
      expect(output).toContain('All configured AI agents are up to date');
    });

    it('should exit 1 with outdated agents', () => {
      // Restore full configuration
      runCLI(`configure-ai-agents --agents claude --no-interactive`);

      // Make it outdated
      updateFile('CLAUDE.md', (content: string) =>
        content.replace('nx_workspace', 'nx_workspace_outdated')
      );

      let didThrow = false;
      try {
        runCLI(`configure-ai-agents --agents claude --check=outdated`);
      } catch {
        didThrow = true;
      }
      expect(didThrow).toBe(true);

      // Restore for next tests
      runCLI(`configure-ai-agents --agents claude --no-interactive`);
    });
  });

  describe('--check=all (comprehensive check)', () => {
    it('should exit 1 on clean workspace with no configured agents', () => {
      removeFile('CLAUDE.md');
      removeFile('.mcp.json');

      let didThrow = false;
      try {
        runCLI(`configure-ai-agents --agents claude --check=all`);
      } catch (e) {
        didThrow = true;
        expect(e.toString()).toContain('not fully configured or up to date');
      }
      expect(didThrow).toBe(true);
    });

    it('should exit 1 with partially configured agents', () => {
      runCLI(`configure-ai-agents --agents claude --no-interactive`);
      removeFile('.mcp.json');

      let didThrow = false;
      try {
        runCLI(`configure-ai-agents --agents claude --check=all`);
      } catch (e) {
        didThrow = true;
        expect(e.toString()).toContain('not fully configured or up to date');
      }
      expect(didThrow).toBe(true);

      // Restore full configuration
      runCLI(`configure-ai-agents --agents claude --no-interactive`);
    });

    it('should exit 1 with outdated agents', () => {
      updateFile('CLAUDE.md', (content: string) =>
        content.replace('nx_workspace', 'nx_workspace_outdated')
      );

      let didThrow = false;
      try {
        runCLI(`configure-ai-agents --agents claude --check=all`);
      } catch (e) {
        didThrow = true;
        expect(e.toString()).toContain('not fully configured or up to date');
      }
      expect(didThrow).toBe(true);

      // Restore
      runCLI(`configure-ai-agents --agents claude --no-interactive`);
    });

    it('should exit 0 with fully configured and up-to-date agents', () => {
      const output = runCLI(`configure-ai-agents --agents claude --check=all`);
      expect(output).toContain(
        'All selected AI agents are fully configured and up to date'
      );
    });
  });
});
