import {
  cleanupProject,
  listFiles,
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
    // Claude uses plugin from marketplace (MCP is included in plugin)
    expect(readFile('.claude/settings.json')).toContain('nx-claude-plugins');
    expect(readFile('.claude/settings.json')).toContain('nx@nx-claude-plugins');
  });

  it('should do nothing if agent is already configured', () => {
    const output = runCLI(
      `configure-ai-agents --agents claude --no-interactive`
    );

    expect(output).toContain('All selected AI agents are already configured');
  });

  it('should throw with --check if agent rules are out of date', () => {
    updateFile('CLAUDE.md', (content: string) =>
      content.replace('nx_docs', 'nx_docs_outdated')
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

    expect(readFile('CLAUDE.md')).not.toContain('nx_docs_outdated');
  });

  describe('--check (backward compatible, defaults to outdated mode)', () => {
    beforeAll(() => {
      // Clean up previous tests
      removeFile('CLAUDE.md');
      removeFile('.claude/settings.json');
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
      removeFile('.claude/settings.json');

      const output = runCLI(
        `configure-ai-agents --agents claude --check=outdated`
      );
      expect(output).toContain('No AI agents are configured');
    });

    it('should exit 0 with partially configured agents (ignores partial configs)', () => {
      runCLI(`configure-ai-agents --agents claude --no-interactive`);
      removeFile('.claude/settings.json');

      const output = runCLI(
        `configure-ai-agents --agents claude --check=outdated`
      );
      // Should exit 0 because partially configured agents are not considered "fully configured"
      // so outdated mode reports no agents configured
      expect(output).toContain('No AI agents are configured');
    });

    it('should exit 1 with outdated agents', () => {
      // Restore full configuration
      runCLI(`configure-ai-agents --agents claude --no-interactive`);

      // Make it outdated
      updateFile('CLAUDE.md', (content: string) =>
        content.replace('nx_docs', 'nx_docs_outdated')
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
      removeFile('.claude/settings.json');

      let didThrow = false;
      try {
        runCLI(`configure-ai-agents --agents claude --check=all`);
      } catch {
        didThrow = true;
      }
      expect(didThrow).toBe(true);
    });

    it('should exit 1 with partially configured agents', () => {
      runCLI(`configure-ai-agents --agents claude --no-interactive`);
      removeFile('.claude/settings.json');

      let didThrow = false;
      try {
        runCLI(`configure-ai-agents --agents claude --check=all`);
      } catch {
        didThrow = true;
      }
      expect(didThrow).toBe(true);

      // Restore full configuration for next tests
      runCLI(`configure-ai-agents --agents claude --no-interactive`);
    });

    it('should exit 1 with outdated agents', () => {
      updateFile('CLAUDE.md', (content: string) =>
        content.replace('nx_docs', 'nx_docs_outdated')
      );

      let didThrow = false;
      try {
        runCLI(`configure-ai-agents --agents claude --check=all`);
      } catch {
        didThrow = true;
      }
      expect(didThrow).toBe(true);

      // Restore for next test
      runCLI(`configure-ai-agents --agents claude --no-interactive`);
    });

    it('should exit 0 with fully configured and up-to-date agents', () => {
      // Ensure clean state
      runCLI(`configure-ai-agents --agents claude --no-interactive`);

      const output = runCLI(`configure-ai-agents --agents claude --check=all`);
      expect(output).toContain(
        'All selected AI agents are fully configured and up to date'
      );
    });
  });

  describe('opencode agent', () => {
    it('should create opencode.json and .opencode/skills directory', () => {
      runCLI(`configure-ai-agents --agents opencode --no-interactive`);

      // Verify opencode.json exists and contains nx-mcp config
      expect(readFile('opencode.json')).toContain('nx-mcp');

      // Verify .opencode/skills is a directory with content
      const skillsContents = listFiles('.opencode/skills');
      expect(skillsContents.length).toBeGreaterThan(0);
    });
  });
});
