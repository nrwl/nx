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
  beforeAll(() => {
    process.env.NX_USE_LOCAL = 'true';
    newProject({ packages: ['@nx/web', '@nx/js', '@nx/react'] });
  });
  afterAll(() => {
    delete process.env.NX_USE_LOCAL;
    cleanupProject();
  });

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

  describe('codex agent', () => {
    it('should create config.toml with MCP config, features, and agents', () => {
      runCLI(`configure-ai-agents --agents codex --no-interactive`);

      const configToml = readFile('.codex/config.toml');
      // MCP server configured
      expect(configToml).toContain('nx-mcp');
      expect(configToml).toContain('npx');
      // Multi-agent feature enabled
      expect(configToml).toContain('multi_agent');
      // Agent definitions present
      expect(configToml).toContain('ci-monitor-subagent');
    });

    it('should copy agent TOML files and skills', () => {
      // Agent TOML files
      const agentFiles = listFiles('.codex/agents');
      expect(agentFiles.length).toBeGreaterThan(0);
      expect(agentFiles.some((f) => f.includes('ci-monitor-subagent'))).toBe(
        true
      );

      // Skills
      const skillsContents = listFiles('.agents/skills');
      expect(skillsContents.length).toBeGreaterThan(0);
    });

    it('should preserve existing user config on re-run', () => {
      // Add custom user content to config.toml
      updateFile('.codex/config.toml', (content: string) => {
        return (
          content +
          '\n[mcp_servers.my-custom-server]\ncommand = "my-server"\nargs = []\n'
        );
      });

      runCLI(`configure-ai-agents --agents codex --no-interactive`);

      const configToml = readFile('.codex/config.toml');
      // Nx config still present
      expect(configToml).toContain('nx-mcp');
      // User's custom config preserved
      expect(configToml).toContain('my-custom-server');
    });

    it('should respect multi_agent = false set by user', () => {
      // User explicitly disables multi-agent
      updateFile('.codex/config.toml', (content: string) =>
        content.replace(/multi_agent\s*=\s*true/, 'multi_agent = false')
      );

      runCLI(`configure-ai-agents --agents codex --no-interactive`);

      const configToml = readFile('.codex/config.toml');
      expect(configToml).toMatch(/multi_agent\s*=\s*false/);
    });
  });

  describe('--no-interactive without --agents (AI agent-like mode)', () => {
    // Without explicit --agents, --no-interactive should behave like AI agent
    // mode: update outdated agents only, report non-configured ones.

    beforeAll(() => {
      // Start clean: remove all agent configs
      removeFile('CLAUDE.md');
      removeFile('.claude');
      removeFile('.gemini');
      removeFile('AGENTS.md');
      removeFile('opencode.json');
      removeFile('.opencode');
      removeFile('.codex');
    });

    it('should report all agents as not yet configured on a clean workspace', () => {
      const output = runCLI('configure-ai-agents --no-interactive');

      // Nothing should have been configured
      expect(() => readFile('CLAUDE.md')).toThrow();

      // Should report non-configured agents
      expect(output).toContain('not yet configured');
      expect(output).toContain('configure-ai-agents --agents');
    });

    it('should update outdated agents and report non-configured ones', () => {
      // Configure claude first
      runCLI('configure-ai-agents --agents claude --no-interactive');
      expect(readFile('CLAUDE.md')).toContain('# General Guidelines');

      // Make it outdated
      updateFile('CLAUDE.md', (content: string) =>
        content.replace('nx_docs', 'nx_docs_outdated')
      );

      const output = runCLI('configure-ai-agents --no-interactive');

      // Should have updated the outdated claude config
      expect(readFile('CLAUDE.md')).not.toContain('nx_docs_outdated');
      expect(output).toContain('configured successfully');

      // Should report non-configured agents
      expect(output).toContain('not yet configured');
    });

    it('should report up-to-date when all configured agents are current', () => {
      // Claude is already fully configured from previous test
      const output = runCLI('configure-ai-agents --no-interactive');

      expect(output).toContain('up to date');
    });

    it('should not configure partially configured agents', () => {
      // Remove the rules file to make claude partially configured
      removeFile('CLAUDE.md');

      const output = runCLI('configure-ai-agents --no-interactive');

      // Should NOT have restored the missing rules file — partial agents
      // are not auto-configured (same as AI agent mode for non-detected agents)
      expect(() => readFile('CLAUDE.md')).toThrow();
      expect(output).toContain('up to date');

      // Restore for subsequent tests
      runCLI('configure-ai-agents --agents claude --no-interactive');
    });
  });

  describe('when running from a detected AI agent', () => {
    // Simulate Claude Code detection via CLAUDECODE env var.
    // No --no-interactive flag, no --agents flag: the command auto-detects
    // which agent is calling it and configures accordingly.
    const claudeEnv = { CLAUDECODE: '1' };

    beforeAll(() => {
      // Start clean: remove all agent configs
      removeFile('CLAUDE.md');
      removeFile('.claude');
      removeFile('.gemini');
    });

    it('should configure the detected agent without prompting on a clean workspace', () => {
      // No --agents flag — the command detects claude via CLAUDECODE env var
      const output = runCLI('configure-ai-agents', {
        env: claudeEnv,
      });

      // Should have configured claude (the detected agent)
      expect(readFile('CLAUDE.md')).toContain('# General Guidelines');
      expect(readFile('.claude/settings.json')).toContain('nx-claude-plugins');

      // Should mention other unconfigured agents with a command to configure them
      expect(output).toContain('not yet configured');
      expect(output).toContain('configure-ai-agents --agents');
    });

    it('should report up-to-date when the detected agent is fully configured', () => {
      // Claude is already fully configured from previous test
      const output = runCLI('configure-ai-agents', {
        env: claudeEnv,
      });

      expect(output).toContain('up to date');
    });

    it('should update the detected agent when its rules are outdated', () => {
      // Make claude outdated
      updateFile('CLAUDE.md', (content: string) =>
        content.replace('nx_docs', 'nx_docs_outdated')
      );

      const output = runCLI('configure-ai-agents', {
        env: claudeEnv,
      });

      // Should have updated claude's rules
      expect(readFile('CLAUDE.md')).not.toContain('nx_docs_outdated');
      expect(output).toContain('configured successfully');
    });

    it('should update other outdated agents alongside the detected agent', () => {
      // Configure gemini fully first
      runCLI('configure-ai-agents --agents gemini --no-interactive');
      expect(readFile('AGENTS.md')).toBeTruthy();

      // Make gemini outdated
      updateFile('AGENTS.md', (content: string) =>
        content.replace('nx_docs', 'nx_docs_outdated')
      );

      // Run from detected claude agent — should also update outdated gemini
      const output = runCLI('configure-ai-agents', {
        env: claudeEnv,
      });

      // Gemini should have been updated because it was outdated
      expect(readFile('AGENTS.md')).not.toContain('nx_docs_outdated');
      expect(output).toContain('configured successfully');
    });

    it('should list non-configured agents with a suggested command', () => {
      // Remove gemini config to make it non-configured
      // Note: .gemini removal is sufficient — without settings.json, gemini is non-configured
      removeFile('.gemini');

      const output = runCLI('configure-ai-agents', {
        env: claudeEnv,
      });

      // Claude is up-to-date, gemini is non-configured
      // Should suggest running configure-ai-agents for gemini
      expect(output).toContain('not yet configured');
      expect(output).toContain('gemini');
      expect(output).toContain('configure-ai-agents --agents');
    });

    it('should ignore the detected agent when --agents is explicitly passed', () => {
      // Clean up both agents
      removeFile('CLAUDE.md');
      removeFile('.claude');
      removeFile('.gemini');

      // Explicitly pass --agents gemini — should ONLY configure gemini,
      // ignoring the detected claude agent entirely
      runCLI('configure-ai-agents --agents gemini --no-interactive', {
        env: claudeEnv,
      });

      // Gemini should be configured because it was explicitly requested
      expect(readFile('AGENTS.md')).toContain('# General Guidelines');

      // Claude should NOT be configured — --agents overrides detection
      expect(() => readFile('CLAUDE.md')).toThrow();
    });

    it('should throw with --check when the detected agent is outdated', () => {
      // Restore claude config (previous test removed it)
      runCLI('configure-ai-agents --agents claude --no-interactive');

      // Make claude outdated
      updateFile('CLAUDE.md', (content: string) =>
        content.replace('nx_docs', 'nx_docs_outdated')
      );

      let didThrow = false;
      try {
        runCLI('configure-ai-agents --check', {
          env: claudeEnv,
        });
      } catch {
        didThrow = true;
      }
      expect(didThrow).toBe(true);

      // Restore
      runCLI('configure-ai-agents --agents claude --no-interactive');
    });

    it('should throw with --check when a non-detected agent is outdated', () => {
      // Configure gemini fully
      runCLI('configure-ai-agents --agents gemini --no-interactive');

      // Make gemini outdated while claude stays up-to-date
      updateFile('AGENTS.md', (content: string) =>
        content.replace('nx_docs', 'nx_docs_outdated')
      );

      let didThrow = false;
      try {
        runCLI('configure-ai-agents --check', {
          env: claudeEnv,
        });
      } catch {
        didThrow = true;
      }
      expect(didThrow).toBe(true);

      // Restore
      runCLI('configure-ai-agents --agents gemini --no-interactive');
    });

    it('should not throw with --check when --agents scopes to up-to-date agents only', () => {
      // Make claude outdated
      updateFile('CLAUDE.md', (content: string) =>
        content.replace('nx_docs', 'nx_docs_outdated')
      );

      // --agents gemini --check should only check gemini, ignoring
      // the detected (and outdated) claude entirely
      const output = runCLI('configure-ai-agents --agents gemini --check', {
        env: claudeEnv,
      });
      expect(output).toContain('up to date');

      // Restore
      runCLI('configure-ai-agents --agents claude --no-interactive');
    });
  });
});
