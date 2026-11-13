import {
  cleanupProject,
  createFile,
  fileExists,
  listFiles,
  newProject,
  readFile,
  removeFile,
  runCLI,
  tmpProjPath,
  updateFile,
} from '@nx/e2e-utils';

// Both leave the agent configured but different from what the generator writes.
function makeClaudeOutdated() {
  updateFile('.claude/settings.json', (content: string) => {
    const settings = JSON.parse(content);
    delete settings.extraKnownMarketplaces;
    return JSON.stringify(settings, null, 2);
  });
}

function makeGeminiOutdated() {
  updateFile('.gemini/settings.json', (content: string) => {
    const settings = JSON.parse(content);
    settings.mcpServers['nx-mcp'].command = 'outdated';
    return JSON.stringify(settings, null, 2);
  });
}

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

    // Claude uses plugin from marketplace (MCP is included in plugin)
    expect(readFile('.claude/settings.json')).toContain('nx-claude-plugins');
    expect(readFile('.claude/settings.json')).toContain('nx@nx-claude-plugins');
    expect(fileExists(tmpProjPath('CLAUDE.md'))).toBeFalsy();
    expect(fileExists(tmpProjPath('AGENTS.md'))).toBeFalsy();
  });

  it('should do nothing if agent is already configured', () => {
    const output = runCLI(
      `configure-ai-agents --agents claude --no-interactive`
    );

    expect(output).toContain('All selected AI agents are already configured');
  });

  it('should throw with --check if agent configuration is out of date', () => {
    makeClaudeOutdated();

    let didThrow = false;
    try {
      runCLI(`configure-ai-agents --agents claude --check`);
    } catch {
      didThrow = true;
    }
    expect(didThrow).toBe(true);
  });

  it('should update agent configuration if out of date', () => {
    runCLI(`configure-ai-agents --agents claude --no-interactive`);

    expect(readFile('.claude/settings.json')).toContain(
      'extraKnownMarketplaces'
    );
  });

  describe('--check (backward compatible, defaults to outdated mode)', () => {
    beforeAll(() => {
      // Clean up previous tests
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
      removeFile('.claude/settings.json');

      const output = runCLI(
        `configure-ai-agents --agents claude --check=outdated`
      );
      expect(output).toContain('No AI agents are configured');
    });

    it('should exit 1 with outdated agents', () => {
      // Restore full configuration
      runCLI(`configure-ai-agents --agents claude --no-interactive`);

      makeClaudeOutdated();

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
      removeFile('.claude/settings.json');

      let didThrow = false;
      try {
        runCLI(`configure-ai-agents --agents claude --check=all`);
      } catch {
        didThrow = true;
      }
      expect(didThrow).toBe(true);
    });

    it('should exit 1 with outdated agents', () => {
      runCLI(`configure-ai-agents --agents claude --no-interactive`);
      makeClaudeOutdated();

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

  describe('gemini legacy .gemini/skills cleanup', () => {
    it('should remove .gemini/skills that also exist in .agents/skills', () => {
      // Ensure gemini is configured so .agents/skills exists
      runCLI('configure-ai-agents --agents gemini --no-interactive');
      expect(listFiles('.agents/skills').length).toBeGreaterThan(0);

      // Simulate legacy .gemini/skills with a skill that matches one in .agents/skills
      const sharedSkill = listFiles('.agents/skills')[0];
      createFile(`.gemini/skills/${sharedSkill}/skill.md`, '# Legacy skill');

      // Also create a user-owned custom skill
      createFile(
        '.gemini/skills/my-custom-skill/skill.md',
        '# My Custom Skill'
      );

      // Make gemini outdated so re-running triggers the generator
      makeGeminiOutdated();

      // Re-run configure to trigger cleanup
      runCLI('configure-ai-agents --agents gemini --no-interactive');

      // The shared skill should be removed from .gemini/skills
      expect(
        fileExists(tmpProjPath(`.gemini/skills/${sharedSkill}/skill.md`))
      ).toBeFalsy();

      // The user's custom skill should be preserved
      expect(
        fileExists(tmpProjPath('.gemini/skills/my-custom-skill/skill.md'))
      ).toBeTruthy();
    });
  });

  describe('--no-interactive without --agents (AI agent-like mode)', () => {
    // Without explicit --agents, --no-interactive should behave like AI agent
    // mode: update outdated agents only, report non-configured ones.

    beforeAll(() => {
      // Start clean: remove all agent configs
      removeFile('.claude');
      removeFile('.gemini');
      removeFile('opencode.json');
      removeFile('.opencode');
      removeFile('.codex');
    });

    it('should report all agents as not yet configured on a clean workspace', () => {
      const output = runCLI('configure-ai-agents --no-interactive');

      // Nothing should have been configured
      expect(() => readFile('.claude/settings.json')).toThrow();

      // Should report non-configured agents
      expect(output).toContain('not yet configured');
      expect(output).toContain('configure-ai-agents --agents');
    });

    it('should update outdated agents and report non-configured ones', () => {
      // Configure claude first
      runCLI('configure-ai-agents --agents claude --no-interactive');

      makeClaudeOutdated();

      const output = runCLI('configure-ai-agents --no-interactive');

      // Should have updated the outdated claude config
      expect(readFile('.claude/settings.json')).toContain(
        'extraKnownMarketplaces'
      );
      expect(output).toContain('configured successfully');

      // Should report non-configured agents
      expect(output).toContain('not yet configured');
    });

    it('should report up-to-date when all configured agents are current', () => {
      // Claude is already fully configured from previous test
      const output = runCLI('configure-ai-agents --no-interactive');

      expect(output).toContain('up to date');
    });
  });

  describe('when running from a detected AI agent', () => {
    // Simulate Claude Code detection via CLAUDECODE env var.
    // No --no-interactive flag, no --agents flag: the command auto-detects
    // which agent is calling it and configures accordingly.
    const claudeEnv = { CLAUDECODE: '1' };

    beforeAll(() => {
      // Start clean: remove all agent configs
      removeFile('.claude');
      removeFile('.gemini');
    });

    it('should configure the detected agent without prompting on a clean workspace', () => {
      // No --agents flag — the command detects claude via CLAUDECODE env var
      const output = runCLI('configure-ai-agents', {
        env: claudeEnv,
      });

      // Should have configured claude (the detected agent)
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

    it('should update the detected agent when its configuration is outdated', () => {
      makeClaudeOutdated();

      const output = runCLI('configure-ai-agents', {
        env: claudeEnv,
      });

      // Should have updated claude's configuration
      expect(readFile('.claude/settings.json')).toContain(
        'extraKnownMarketplaces'
      );
      expect(output).toContain('configured successfully');
    });

    it('should update other outdated agents alongside the detected agent', () => {
      // Configure gemini fully first
      runCLI('configure-ai-agents --agents gemini --no-interactive');

      // Make gemini outdated
      makeGeminiOutdated();

      // Run from detected claude agent — should also update outdated gemini
      const output = runCLI('configure-ai-agents', {
        env: claudeEnv,
      });

      // Gemini should have been updated because it was outdated
      expect(readFile('.gemini/settings.json')).not.toContain('outdated');
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
      removeFile('.claude');
      removeFile('.gemini');

      // Explicitly pass --agents gemini — should ONLY configure gemini,
      // ignoring the detected claude agent entirely
      runCLI('configure-ai-agents --agents gemini --no-interactive', {
        env: claudeEnv,
      });

      // Gemini should be configured because it was explicitly requested
      expect(readFile('.gemini/settings.json')).toContain('nx-mcp');

      // Claude should NOT be configured — --agents overrides detection
      expect(() => readFile('.claude/settings.json')).toThrow();
    });

    it('should throw with --check when the detected agent is outdated', () => {
      // Restore claude config (previous test removed it)
      runCLI('configure-ai-agents --agents claude --no-interactive');

      makeClaudeOutdated();

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
      makeGeminiOutdated();

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
      makeClaudeOutdated();

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

  describe('rules files', () => {
    const nxBlock =
      '<!-- nx configuration start-->\nOutdated\n<!-- nx configuration end-->';

    it('should report an agent as outdated while an Nx block is left', () => {
      runCLI('configure-ai-agents --agents claude --no-interactive');
      createFile('AGENTS.md', `# My Project\n\n${nxBlock}\n`);
      createFile('CLAUDE.md', `${nxBlock}\n`);

      let didThrow = false;
      try {
        runCLI('configure-ai-agents --agents claude --check');
      } catch {
        didThrow = true;
      }
      expect(didThrow).toBe(true);
    });

    it('should remove the Nx block and keep the rest of the file', () => {
      runCLI('configure-ai-agents --agents claude --no-interactive');

      expect(readFile('AGENTS.md')).toEqual('# My Project\n');
      expect(fileExists(tmpProjPath('CLAUDE.md'))).toBeFalsy();
    });

    it('should leave rules files without an Nx block untouched', () => {
      const existing = '# My Project\n\nMy own rules\n';
      createFile('AGENTS.md', existing);
      createFile('CLAUDE.md', existing);
      makeClaudeOutdated();

      runCLI('configure-ai-agents --agents claude --no-interactive');

      expect(readFile('AGENTS.md')).toEqual(existing);
      expect(readFile('CLAUDE.md')).toEqual(existing);
    });
  });
});
