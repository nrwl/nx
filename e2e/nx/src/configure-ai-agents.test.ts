import {
  cleanupProject,
  createFile,
  fileExists,
  newProject,
  readFile,
  readJson,
  removeFile,
  runCLI,
  tmpProjPath,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';

const nxRulesBlock =
  '<!-- nx configuration start-->\n# General Guidelines for working with Nx\n<!-- nx configuration end-->\n';

// Drops the sandbox grants configure-ai-agents writes, so a configured Claude
// setup no longer matches what the command would write.
function makeClaudeOutdated() {
  updateJson('.claude/settings.json', (json) => {
    delete json.sandbox;
    return json;
  });
}

function runCLIExpectingFailure(command: string, env?: Record<string, string>) {
  let didThrow = false;
  try {
    runCLI(command, env ? { env } : undefined);
  } catch {
    didThrow = true;
  }
  return didThrow;
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

  it('should register the Claude plugin without writing rules files', () => {
    runCLI(`configure-ai-agents --agents claude --no-interactive`);

    const settings = readJson('.claude/settings.json');
    expect(settings.extraKnownMarketplaces['nx-claude-plugins']).toBeDefined();
    expect(settings.enabledPlugins['nx@nx-claude-plugins']).toBe(true);
    expect(fileExists(tmpProjPath('CLAUDE.md'))).toBeFalsy();
    expect(fileExists(tmpProjPath('AGENTS.md'))).toBeFalsy();
  });

  it('should do nothing if agent is already configured', () => {
    const output = runCLI(
      `configure-ai-agents --agents claude --no-interactive`
    );

    expect(output).toContain('All selected AI agents are already configured');
  });

  it('should throw with --check if the agent configuration is out of date', () => {
    makeClaudeOutdated();

    expect(
      runCLIExpectingFailure(`configure-ai-agents --agents claude --check`)
    ).toBe(true);
  });

  it('should update the agent configuration if out of date', () => {
    runCLI(`configure-ai-agents --agents claude --no-interactive`);

    expect(readJson('.claude/settings.json').sandbox).toBeDefined();
  });

  describe('--check (backward compatible, defaults to outdated mode)', () => {
    beforeAll(() => {
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
      runCLI(`configure-ai-agents --agents claude --no-interactive`);
      makeClaudeOutdated();

      expect(
        runCLIExpectingFailure(
          `configure-ai-agents --agents claude --check=outdated`
        )
      ).toBe(true);

      runCLI(`configure-ai-agents --agents claude --no-interactive`);
    });
  });

  describe('--check=all (comprehensive check)', () => {
    it('should exit 1 on clean workspace with no configured agents', () => {
      removeFile('.claude/settings.json');

      expect(
        runCLIExpectingFailure(
          `configure-ai-agents --agents claude --check=all`
        )
      ).toBe(true);
    });

    it('should exit 1 with outdated agents', () => {
      runCLI(`configure-ai-agents --agents claude --no-interactive`);
      makeClaudeOutdated();

      expect(
        runCLIExpectingFailure(
          `configure-ai-agents --agents claude --check=all`
        )
      ).toBe(true);

      runCLI(`configure-ai-agents --agents claude --no-interactive`);
    });

    it('should exit 0 with fully configured and up-to-date agents', () => {
      const output = runCLI(`configure-ai-agents --agents claude --check=all`);
      expect(output).toContain(
        'All selected AI agents are fully configured and up to date'
      );
    });
  });

  describe('codex agent', () => {
    it('should enable the Nx plugin for the project', () => {
      runCLI(`configure-ai-agents --agents codex --no-interactive`);

      const configToml = readFile('.codex/config.toml');
      expect(configToml).toContain('[plugins."nx@nx-agent-plugins"]');
      expect(configToml).not.toContain('nx-mcp');
      expect(fileExists(tmpProjPath('.codex/agents'))).toBeFalsy();
    });

    it('should preserve existing user config on re-run', () => {
      updateFile(
        '.codex/config.toml',
        (content: string) =>
          content +
          '\n[mcp_servers.my-custom-server]\ncommand = "my-server"\nargs = []\n'
      );

      runCLI(`configure-ai-agents --agents codex --no-interactive`);

      const configToml = readFile('.codex/config.toml');
      expect(configToml).toContain('nx@nx-agent-plugins');
      expect(configToml).toContain('my-custom-server');
    });
  });

  describe('setups from older versions', () => {
    it('should remove Nx blocks and the Copilot and Gemini setups', () => {
      createFile('AGENTS.md', nxRulesBlock);
      createFile(
        '.gemini/settings.json',
        JSON.stringify({
          contextFileName: 'AGENTS.md',
          mcpServers: { 'nx-mcp': { command: 'npx', args: ['nx', 'mcp'] } },
        })
      );

      runCLI(`configure-ai-agents --agents claude --no-interactive`);

      expect(fileExists(tmpProjPath('AGENTS.md'))).toBeFalsy();
      expect(fileExists(tmpProjPath('.gemini/settings.json'))).toBeFalsy();
    });
  });

  describe('agents nx no longer supports', () => {
    it('should warn and continue with the supported agents', () => {
      removeFile('.claude');

      const output = runCLI(
        `configure-ai-agents --agents claude gemini --no-interactive`
      );

      expect(output).toContain(
        'Gemini is no longer supported by nx configure-ai-agents'
      );
      expect(readJson('.claude/settings.json').enabledPlugins).toBeDefined();
    });

    it('should fail when no supported agent is left', () => {
      expect(
        runCLIExpectingFailure(
          `configure-ai-agents --agents copilot --no-interactive`
        )
      ).toBe(true);
    });
  });

  describe('--no-interactive without --agents (AI agent-like mode)', () => {
    // Without explicit --agents, --no-interactive should behave like AI agent
    // mode: update outdated agents only, report non-configured ones.

    beforeAll(() => {
      removeFile('.claude');
      removeFile('opencode.json');
      removeFile('.codex');
    });

    it('should report all agents as not yet configured on a clean workspace', () => {
      const output = runCLI('configure-ai-agents --no-interactive');

      expect(fileExists(tmpProjPath('.claude/settings.json'))).toBeFalsy();
      expect(output).toContain('not yet configured');
      expect(output).toContain('configure-ai-agents --agents');
    });

    it('should update outdated agents and report non-configured ones', () => {
      runCLI('configure-ai-agents --agents claude --no-interactive');
      makeClaudeOutdated();

      const output = runCLI('configure-ai-agents --no-interactive');

      expect(readJson('.claude/settings.json').sandbox).toBeDefined();
      expect(output).toContain('configured successfully');
      expect(output).toContain('not yet configured');
    });

    it('should report up-to-date when all configured agents are current', () => {
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
      removeFile('.claude');
      removeFile('.codex');
    });

    it('should configure the detected agent without prompting on a clean workspace', () => {
      const output = runCLI('configure-ai-agents', { env: claudeEnv });

      expect(readFile('.claude/settings.json')).toContain('nx-claude-plugins');
      expect(output).toContain('not yet configured');
      expect(output).toContain('configure-ai-agents --agents');
    });

    it('should report up-to-date when the detected agent is fully configured', () => {
      const output = runCLI('configure-ai-agents', { env: claudeEnv });

      expect(output).toContain('up to date');
    });

    it('should update the detected agent when it is outdated', () => {
      makeClaudeOutdated();

      const output = runCLI('configure-ai-agents', { env: claudeEnv });

      expect(readJson('.claude/settings.json').sandbox).toBeDefined();
      expect(output).toContain('configured successfully');
    });

    it('should update other outdated agents alongside the detected agent', () => {
      runCLI('configure-ai-agents --agents codex --no-interactive');
      // An nx-mcp entry from an older setup makes Codex outdated
      updateFile(
        '.codex/config.toml',
        (content: string) =>
          content + '\n[mcp_servers.nx-mcp]\ncommand = "npx"\n'
      );

      const output = runCLI('configure-ai-agents', { env: claudeEnv });

      expect(readFile('.codex/config.toml')).not.toContain('nx-mcp');
      expect(output).toContain('configured successfully');
    });

    it('should list non-configured agents with a suggested command', () => {
      removeFile('.codex');

      const output = runCLI('configure-ai-agents', { env: claudeEnv });

      expect(output).toContain('not yet configured');
      expect(output).toContain('codex');
      expect(output).toContain('configure-ai-agents --agents');
    });

    it('should ignore the detected agent when --agents is explicitly passed', () => {
      removeFile('.claude');

      runCLI('configure-ai-agents --agents codex --no-interactive', {
        env: claudeEnv,
      });

      expect(readFile('.codex/config.toml')).toContain('nx@nx-agent-plugins');
      expect(fileExists(tmpProjPath('.claude/settings.json'))).toBeFalsy();
    });

    it('should throw with --check when the detected agent is outdated', () => {
      runCLI('configure-ai-agents --agents claude --no-interactive');
      makeClaudeOutdated();

      expect(
        runCLIExpectingFailure('configure-ai-agents --check', claudeEnv)
      ).toBe(true);

      runCLI('configure-ai-agents --agents claude --no-interactive');
    });

    it('should throw with --check when a non-detected agent is outdated', () => {
      updateFile(
        '.codex/config.toml',
        (content: string) =>
          content + '\n[mcp_servers.nx-mcp]\ncommand = "npx"\n'
      );

      expect(
        runCLIExpectingFailure('configure-ai-agents --check', claudeEnv)
      ).toBe(true);

      runCLI('configure-ai-agents --agents codex --no-interactive');
    });

    it('should not throw with --check when --agents scopes to up-to-date agents only', () => {
      makeClaudeOutdated();

      const output = runCLI('configure-ai-agents --agents codex --check', {
        env: claudeEnv,
      });
      expect(output).toContain('up to date');

      runCLI('configure-ai-agents --agents claude --no-interactive');
    });
  });
});
