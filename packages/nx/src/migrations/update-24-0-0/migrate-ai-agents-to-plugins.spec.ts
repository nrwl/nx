import type { MockInstance } from 'vitest';
import TOML from 'smol-toml';
import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import { Tree } from '../../generators/tree';
import { readJson } from '../../generators/utils/json';
import * as agentPluginVersion from '../../ai/set-up-ai-agents/agent-plugin-version';
import * as codexPluginModule from '../../ai/set-up-ai-agents/codex-plugin';
import migrateAiAgentsToPlugins from './migrate-ai-agents-to-plugins';

// Contents of files earlier versions copied into workspaces. The real list is
// generated from the history of nrwl/nx-ai-agents-config.
const shipped = vi.hoisted<Record<string, string>>(() => ({
  '.cursor/agents/ci-monitor-subagent.md': 'shipped cursor agent',
  '.opencode/commands/monitor-ci.md': 'shipped opencode command',
  '.github/skills/nx-workspace/SKILL.md': 'shipped copilot skill',
}));

vi.mock('../../ai/set-up-ai-agents/legacy-agent-files', async () => {
  const { createHash } = await import('crypto');
  // Same as fingerprintAgentFile, which can't be imported here because its
  // module depends on this one.
  const fingerprintAgentFile = (content: string) =>
    createHash('sha256')
      .update(content.toLowerCase().replace(/[^a-z0-9]/g, ''))
      .digest('hex')
      .slice(0, 16);
  return {
    legacyAgentFiles: Object.fromEntries(
      Object.entries(shipped).map(([path, content]) => [
        path,
        [fingerprintAgentFile(content)],
      ])
    ),
  };
});

const nxRules =
  '<!-- nx configuration start-->\n# General Guidelines for working with Nx\n<!-- nx configuration end-->\n';

describe('migrate-ai-agents-to-plugins migration', () => {
  let tree: Tree;
  let latestPluginVersionSpy: MockInstance;
  let isCodexAvailableSpy: MockInstance;
  let installCodexPluginSpy: MockInstance;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    latestPluginVersionSpy = vi
      .spyOn(agentPluginVersion, 'getLatestAgentPluginVersion')
      .mockResolvedValue('1.2.3');
    isCodexAvailableSpy = vi
      .spyOn(codexPluginModule, 'isCodexAvailable')
      .mockReturnValue(true);
    installCodexPluginSpy = vi.spyOn(codexPluginModule, 'installCodexPlugin');
  });

  afterEach(() => {
    latestPluginVersionSpy.mockRestore();
    isCodexAvailableSpy.mockRestore();
    installCodexPluginSpy.mockRestore();
  });

  it('should only remove the Nx guidelines when no agent was set up', async () => {
    tree.write('AGENTS.md', nxRules);

    const nextSteps = await migrateAiAgentsToPlugins(tree);

    expect(tree.exists('AGENTS.md')).toBe(false);
    expect(tree.exists('.claude/settings.json')).toBe(false);
    expect(nextSteps).toEqual([]);
  });

  it('should register the plugins for every agent that was set up', async () => {
    tree.write('CLAUDE.md', `# Ours\n\n${nxRules}`);
    tree.write(
      '.cursor/agents/ci-monitor-subagent.md',
      shipped['.cursor/agents/ci-monitor-subagent.md']
    );
    tree.write(
      '.codex/config.toml',
      '[mcp_servers."nx-mcp"]\ncommand = "npx"\nargs = ["nx", "mcp"]\n'
    );
    tree.write(
      'opencode.json',
      JSON.stringify({
        mcp: { 'nx-mcp': { type: 'local', command: ['npx', 'nx', 'mcp'] } },
      })
    );
    tree.write(
      '.opencode/commands/monitor-ci.md',
      shipped['.opencode/commands/monitor-ci.md']
    );

    await migrateAiAgentsToPlugins(tree);

    expect(tree.read('CLAUDE.md', 'utf-8')).toEqual('# Ours\n');
    expect(
      readJson(tree, '.claude/settings.json').enabledPlugins[
        'nx@nx-claude-plugins'
      ]
    ).toBe(true);
    expect(
      readJson(tree, '.cursor/settings.json').plugins['nx-agent-plugins/nx']
    ).toEqual({
      enabled: true,
      gitUrl: 'https://github.com/nrwl/nx-ai-agents-config.git',
      gitRef: 'v1.2.3',
    });
    expect(tree.exists('.cursor/agents')).toBe(false);
    expect(TOML.parse(tree.read('.codex/config.toml', 'utf-8'))).toEqual({
      plugins: { 'nx@nx-agent-plugins': { enabled: true } },
    });
    expect(readJson(tree, 'opencode.json')).toEqual({
      plugin: ['@nx/opencode-plugin@1.2.3'],
    });
    expect(tree.exists('.opencode')).toBe(false);
  });

  it('should keep AGENTS.md while an agent without a plugin still reads it', async () => {
    tree.write('AGENTS.md', nxRules);
    tree.write(
      '.github/skills/nx-workspace/SKILL.md',
      shipped['.github/skills/nx-workspace/SKILL.md']
    );
    tree.write(
      '.codex/config.toml',
      '[mcp_servers."nx-mcp"]\ncommand = "npx"\n'
    );

    await migrateAiAgentsToPlugins(tree);

    // The test tree formats files written in the test, so compare loosely
    expect(tree.read('AGENTS.md', 'utf-8')).toContain(
      '<!-- nx configuration start-->'
    );
    expect(TOML.parse(tree.read('.codex/config.toml', 'utf-8'))).toEqual({
      plugins: { 'nx@nx-agent-plugins': { enabled: true } },
    });
  });

  it('should remove AGENTS.md once the migrated agents were its only readers', async () => {
    tree.write('AGENTS.md', nxRules);
    tree.write(
      '.codex/config.toml',
      '[mcp_servers."nx-mcp"]\ncommand = "npx"\n'
    );

    await migrateAiAgentsToPlugins(tree);

    expect(tree.exists('AGENTS.md')).toBe(false);
  });

  it('should not install anything on the machine running the migration', async () => {
    tree.write(
      '.codex/config.toml',
      '[mcp_servers."nx-mcp"]\ncommand = "npx"\n'
    );

    const nextSteps = await migrateAiAgentsToPlugins(tree);

    expect(installCodexPluginSpy).not.toHaveBeenCalled();
    expect(nextSteps).toEqual([
      'Codex installs plugins per user: run "nx configure-ai-agents" once to install the Nx plugin for Codex on your machine. Teammates using Codex need to do the same.',
    ]);
  });

  it('should leave copied files of agents without a plugin alone', async () => {
    tree.write(
      '.github/skills/nx-workspace/SKILL.md',
      shipped['.github/skills/nx-workspace/SKILL.md']
    );

    await migrateAiAgentsToPlugins(tree);

    expect(tree.exists('.github/skills/nx-workspace/SKILL.md')).toBe(true);
  });

  it('should keep copied files and report it when the plugin version is unknown', async () => {
    latestPluginVersionSpy.mockResolvedValue(null);
    tree.write(
      '.cursor/agents/ci-monitor-subagent.md',
      shipped['.cursor/agents/ci-monitor-subagent.md']
    );

    const nextSteps = await migrateAiAgentsToPlugins(tree);

    expect(tree.exists('.cursor/agents/ci-monitor-subagent.md')).toBe(true);
    expect(tree.exists('.cursor/settings.json')).toBe(false);
    expect(nextSteps).toHaveLength(1);
    expect(nextSteps[0]).toContain(
      'Could not configure the Nx plugin for Cursor'
    );
  });
});
