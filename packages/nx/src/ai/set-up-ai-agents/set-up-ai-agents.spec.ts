import type { MockInstance } from 'vitest';
import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import { Tree } from '../../generators/tree';

import { setupAiAgentsGenerator } from './set-up-ai-agents';
import { SetupAiAgentsGeneratorSchema } from './schema';
import { readJson, updateJson } from '../../generators/utils/json';
import { NX_ALLOWLIST_ROOTS } from '../constants';
import * as agentPluginVersion from './agent-plugin-version';
import * as codexPluginModule from './codex-plugin';
import { legacyAgentFiles } from './legacy-agent-files';
import TOML from 'smol-toml';

// Contents of the files earlier versions copied into workspaces, keyed by
// their workspace path. The real list is generated from the history of
// nrwl/nx-ai-agents-config; tests use a small stand-in with known contents.
const shipped = vi.hoisted<Record<string, string>>(() => ({
  '.agents/skills/nx-workspace/SKILL.md': 'shipped shared skill',
  '.codex/agents/ci-monitor-subagent.toml': 'shipped codex agent',
  '.cursor/agents/ci-monitor-subagent.md': 'shipped cursor agent',
  '.cursor/commands/monitor-ci.md': 'shipped cursor command',
  '.opencode/skills/nx-workspace/SKILL.md': 'shipped opencode skill',
  '.github/skills/nx-workspace/SKILL.md': 'shipped copilot skill',
  '.gemini/commands/monitor-ci.toml': 'shipped gemini command',
}));

vi.mock('./legacy-agent-files', async () => {
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

function setAnalytics(tree: Tree, analytics: boolean) {
  updateJson(tree, 'nx.json', (json) => ({ ...json, analytics }));
}

const nxRulesBlock =
  '<!-- nx configuration start-->\n# General Guidelines for working with Nx\n<!-- nx configuration end-->\n';

function shippedContent(path: string): string {
  return shipped[path];
}

describe('setup-ai-agents generator', () => {
  let tree: Tree;
  let latestPluginVersionSpy: MockInstance;
  let isCodexAvailableSpy: MockInstance;
  let isCodexPluginInstalledSpy: MockInstance;
  let installCodexPluginSpy: MockInstance;

  beforeEach(() => {
    // No formatter: these assertions compare against the exact string the
    // generator builds, so any formatting in the loop breaks them.
    tree = createTreeWithEmptyWorkspace({ formatter: 'none' });
    // Use local implementation instead of fetching from latest
    process.env.NX_AI_FILES_USE_LOCAL = 'true';

    latestPluginVersionSpy = vi
      .spyOn(agentPluginVersion, 'getLatestAgentPluginVersion')
      .mockResolvedValue('1.2.3');
    isCodexAvailableSpy = vi
      .spyOn(codexPluginModule, 'isCodexAvailable')
      .mockReturnValue(false);
    isCodexPluginInstalledSpy = vi
      .spyOn(codexPluginModule, 'isCodexPluginInstalled')
      .mockReturnValue(false);
    installCodexPluginSpy = vi
      .spyOn(codexPluginModule, 'installCodexPlugin')
      .mockReturnValue({ ok: true });
  });

  afterEach(() => {
    delete process.env.NX_AI_FILES_USE_LOCAL;
    latestPluginVersionSpy.mockRestore();
    isCodexAvailableSpy.mockRestore();
    isCodexPluginInstalledSpy.mockRestore();
    installCodexPluginSpy.mockRestore();
  });

  it('should use specified directory', async () => {
    const options: SetupAiAgentsGeneratorSchema = {
      directory: 'custom-dir',
    };

    await setupAiAgentsGenerator(tree, options);

    expect(tree.exists('custom-dir/CLAUDE.md')).toBe(false);
    expect(tree.exists('custom-dir/AGENTS.md')).toBe(false);
    expect(tree.exists('custom-dir/.cursor/settings.json')).toBe(true);
    expect(tree.exists('custom-dir/.codex/config.toml')).toBe(true);
    expect(tree.exists('custom-dir/opencode.json')).toBe(true);
    expect(tree.exists('custom-dir/.claude/settings.json')).toBe(true);
  });

  describe('agent-specific file generation', () => {
    describe('claude', () => {
      it('should NOT generate CLAUDE.md when claude is not in agents array', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['codex'],
        };

        await setupAiAgentsGenerator(tree, options);

        expect(tree.exists('CLAUDE.md')).toBe(false);
        expect(tree.exists('.claude/settings.json')).toBe(false);
      });

      it('should create .claude/settings.json with plugin configuration when file does not exist', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['claude'],
        };

        await setupAiAgentsGenerator(tree, options);

        expect(tree.exists('.claude/settings.json')).toBe(true);
        const config = JSON.parse(
          tree.read('.claude/settings.json')?.toString() ?? '{}'
        );
        expect(config.extraKnownMarketplaces['nx-claude-plugins']).toEqual({
          source: {
            source: 'github',
            repo: 'nrwl/nx-ai-agents-config',
            ref: 'dist/next',
          },
          autoUpdate: true,
        });
        expect(config.enabledPlugins['nx@nx-claude-plugins']).toBe(true);
      });

      it('should add plugin configuration to existing .claude/settings.json', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['claude'],
        };

        // Create existing config
        tree.write(
          '.claude/settings.json',
          JSON.stringify({ someOtherConfig: 'value' }, null, 2)
        );

        await setupAiAgentsGenerator(tree, options);

        const config = JSON.parse(
          tree.read('.claude/settings.json')?.toString() ?? '{}'
        );
        expect(config.someOtherConfig).toBe('value');
        expect(config.extraKnownMarketplaces['nx-claude-plugins']).toEqual({
          source: {
            source: 'github',
            repo: 'nrwl/nx-ai-agents-config',
            ref: 'dist/next',
          },
          autoUpdate: true,
        });
        expect(config.enabledPlugins['nx@nx-claude-plugins']).toBe(true);
      });

      it('should put every sandbox grant in the committed settings file', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['claude'],
        };
        tree.write(
          '.claude/settings.json',
          JSON.stringify({
            sandbox: {
              filesystem: {
                allowRead: ['/existing/read'],
                allowWrite: ['/existing/write'],
              },
            },
          })
        );

        await setupAiAgentsGenerator(tree, options);

        const config = readJson(tree, '.claude/settings.json');

        // Every entry is machine-independent, so the committed file is enough
        // and no per-machine settings file is written. Worktree cache data
        // lives under ~/.nx, which the ~/.nx grant already covers.
        expect(tree.exists('.claude/settings.local.json')).toBe(false);
        expect(config.sandbox.filesystem.allowRead).toEqual([
          '/existing/read',
          '/tmp/.nx',
          '~/.nx',
        ]);
        expect(config.sandbox.filesystem.allowWrite).toEqual([
          '/existing/write',
          '/tmp/.nx',
          '~/.nx',
        ]);
        expect(config.sandbox.network.allowUnixSockets).toEqual([
          '/tmp/.nx',
          '~/.nx',
        ]);
        // The scoped entry covers binding, so no blanket grant is written.
        expect(config.sandbox.network.allowAllUnixSockets).toBeUndefined();
      });

      it('should allow analytics requests through the sandbox network filter when analytics are enabled', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['claude'],
        };
        setAnalytics(tree, true);

        await setupAiAgentsGenerator(tree, options);

        const config = JSON.parse(
          tree.read('.claude/settings.json')?.toString() ?? '{}'
        );
        expect(config.sandbox.network.allowedDomains).toEqual([
          'www.google-analytics.com',
        ]);
      });

      it('should not allow analytics requests through the sandbox network filter when analytics are disabled', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['claude'],
        };
        setAnalytics(tree, false);

        await setupAiAgentsGenerator(tree, options);

        const config = JSON.parse(
          tree.read('.claude/settings.json')?.toString() ?? '{}'
        );
        // The socket and filesystem grants are still written: Nx needs them
        // whether or not analytics are on. Only the egress follows the opt-in.
        expect(config.sandbox.network.allowedDomains).toBeUndefined();
        expect(config.sandbox.network.allowUnixSockets).toEqual(
          NX_ALLOWLIST_ROOTS
        );
      });

      it('should not allow analytics requests through the sandbox network filter when no analytics preference is set', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['claude'],
        };

        await setupAiAgentsGenerator(tree, options);

        const config = JSON.parse(
          tree.read('.claude/settings.json')?.toString() ?? '{}'
        );
        // The socket and filesystem grants are still written: Nx needs them
        // whether or not analytics are on. Only the egress follows the opt-in.
        expect(config.sandbox.network.allowedDomains).toBeUndefined();
        expect(config.sandbox.network.allowUnixSockets).toEqual(
          NX_ALLOWLIST_ROOTS
        );
      });

      it('should leave an existing sandbox network filter untouched when analytics are disabled', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['claude'],
        };
        setAnalytics(tree, false);

        tree.write(
          '.claude/settings.json',
          JSON.stringify({
            sandbox: {
              network: {
                allowedDomains: ['example.com'],
              },
            },
          })
        );

        await setupAiAgentsGenerator(tree, options);

        const config = JSON.parse(
          tree.read('.claude/settings.json')?.toString() ?? '{}'
        );
        expect(config.sandbox.network.allowedDomains).toEqual(['example.com']);
      });

      it('should report the sandbox network filter change when the analytics domain is added', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['claude'],
        };
        setAnalytics(tree, true);

        const callback = await setupAiAgentsGenerator(tree, options);
        const { messages } = await callback();

        expect(messages.map((message) => message.title)).toContainEqual(
          expect.stringContaining('www.google-analytics.com')
        );
      });

      it('should not report the sandbox network filter change when the analytics domain is already allowed', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['claude'],
        };
        setAnalytics(tree, true);
        tree.write(
          '.claude/settings.json',
          JSON.stringify({
            sandbox: {
              network: { allowedDomains: ['www.google-analytics.com'] },
            },
          })
        );

        const callback = await setupAiAgentsGenerator(tree, options);
        const { messages } = await callback();

        expect(messages).toEqual([]);
      });

      it('should preserve existing sandbox allowed domains and not duplicate the analytics domain', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['claude'],
        };
        setAnalytics(tree, true);

        tree.write(
          '.claude/settings.json',
          JSON.stringify({
            sandbox: {
              autoAllowBashIfSandboxed: true,
              network: {
                allowedDomains: ['example.com', 'www.google-analytics.com'],
              },
            },
          })
        );

        await setupAiAgentsGenerator(tree, options);

        const config = JSON.parse(
          tree.read('.claude/settings.json')?.toString() ?? '{}'
        );
        expect(config.sandbox.autoAllowBashIfSandboxed).toBe(true);
        expect(config.sandbox.network.allowedDomains).toEqual([
          'example.com',
          'www.google-analytics.com',
        ]);
      });

      it('should allow nx socket usage through the sandbox', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['claude'],
        };

        await setupAiAgentsGenerator(tree, options);

        const config = JSON.parse(
          tree.read('.claude/settings.json')?.toString() ?? '{}'
        );
        // Both roots the socket chain may use. Allowing only /tmp/.nx leaves
        // every user on a machine where a peer created it first uncovered,
        // since Nx then falls back to ~/.nx.
        expect(config.sandbox.network.allowUnixSockets).toEqual([
          '/tmp/.nx',
          '~/.nx',
        ]);
        expect(config.sandbox.filesystem.allowRead).toEqual([
          '/tmp/.nx',
          '~/.nx',
        ]);
        // Covers the tmp root, not just the socket dir: the native binary cache
        // lives under it, and without it a running daemon pins the binding
        // inside node_modules.
        expect(config.sandbox.filesystem.allowWrite).toEqual([
          '/tmp/.nx',
          '~/.nx',
        ]);
      });

      it('should not grant blanket unix socket access', async () => {
        // The scoped entry covers binding as well as connecting, so the blanket
        // grant buys nothing for Nx's own sockets while opening every other
        // socket on the machine — the Docker and SSH-agent sockets included —
        // to connections from sandboxed commands. Verified against Claude Code
        // 2.1.241: with only the scoped roots, a bind under /tmp/.nx and ~/.nx
        // succeeds and a connect to a socket outside them is refused EPERM.
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['claude'],
        };

        await setupAiAgentsGenerator(tree, options);

        const config = JSON.parse(
          tree.read('.claude/settings.json')?.toString() ?? '{}'
        );
        expect(config.sandbox.network.allowAllUnixSockets).toBeUndefined();
        expect(config.sandbox.network.allowUnixSockets).toEqual([
          '/tmp/.nx',
          '~/.nx',
        ]);
      });

      it('should preserve existing sandbox socket and filesystem entries without duplicating the nx ones', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['claude'],
        };

        tree.write(
          '.claude/settings.json',
          JSON.stringify({
            sandbox: {
              filesystem: {
                allowWrite: ['~/.gradle', '/tmp/.nx'],
              },
              network: {
                allowUnixSockets: ['/var/run/docker.sock', '/tmp/.nx'],
              },
            },
          })
        );

        await setupAiAgentsGenerator(tree, options);

        const config = JSON.parse(
          tree.read('.claude/settings.json')?.toString() ?? '{}'
        );
        // The pre-existing entries survive in place, ours is not duplicated,
        // and the root that was missing is appended rather than replacing them.
        expect(config.sandbox.filesystem.allowWrite).toEqual([
          '~/.gradle',
          '/tmp/.nx',
          '~/.nx',
        ]);
        expect(config.sandbox.filesystem.allowRead).toEqual([
          '/tmp/.nx',
          '~/.nx',
        ]);
        expect(config.sandbox.network.allowUnixSockets).toEqual([
          '/var/run/docker.sock',
          '/tmp/.nx',
          '~/.nx',
        ]);
      });

      it.each([undefined, 'dist/latest'])(
        'should move a marketplace on ref %s to the channel branch',
        async (ref) => {
          tree.write(
            '.claude/settings.json',
            JSON.stringify({
              extraKnownMarketplaces: {
                'nx-claude-plugins': {
                  source: {
                    source: 'github',
                    repo: 'nrwl/nx-ai-agents-config',
                    ref,
                  },
                },
              },
            })
          );

          await setupAiAgentsGenerator(tree, {
            directory: '.',
            agents: ['claude'],
          });

          expect(
            readJson(tree, '.claude/settings.json').extraKnownMarketplaces[
              'nx-claude-plugins'
            ].source.ref
          ).toEqual('dist/next');
        }
      );

      it('should preserve existing ref in nx-claude-plugins source', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['claude'],
        };

        // Create existing config with a custom ref
        tree.write(
          '.claude/settings.json',
          JSON.stringify({
            extraKnownMarketplaces: {
              'nx-claude-plugins': {
                source: {
                  source: 'github',
                  repo: 'nrwl/nx-ai-agents-config',
                  ref: 'experimental',
                },
              },
            },
            enabledPlugins: {
              'nx@nx-claude-plugins': true,
            },
          })
        );

        await setupAiAgentsGenerator(tree, options);

        const config = JSON.parse(
          tree.read('.claude/settings.json')?.toString() ?? '{}'
        );
        expect(config.extraKnownMarketplaces['nx-claude-plugins']).toEqual({
          source: {
            source: 'github',
            repo: 'nrwl/nx-ai-agents-config',
            ref: 'experimental',
          },
          autoUpdate: true,
        });
      });

      it('should keep auto-update off when the workspace turned it off', async () => {
        tree.write(
          '.claude/settings.json',
          JSON.stringify({
            extraKnownMarketplaces: {
              'nx-claude-plugins': {
                source: { source: 'github', repo: 'nrwl/nx-ai-agents-config' },
                autoUpdate: false,
              },
            },
          })
        );

        await setupAiAgentsGenerator(tree, {
          directory: '.',
          agents: ['claude'],
        });

        const config = JSON.parse(tree.read('.claude/settings.json', 'utf-8'));
        expect(
          config.extraKnownMarketplaces['nx-claude-plugins'].autoUpdate
        ).toBe(false);
      });

      it('should NOT write to .mcp.json for claude (MCP is provided by plugin)', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['claude'],
        };

        await setupAiAgentsGenerator(tree, options);

        expect(tree.exists('.mcp.json')).toBe(false);
      });
    });

    describe('gitignore', () => {
      it('should add .nx/polygraph to .gitignore when it does not exist', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['claude'],
        };

        await setupAiAgentsGenerator(tree, options);

        const gitignore = tree.read('.gitignore')?.toString();
        expect(gitignore).toContain('.nx/polygraph');
      });

      it('should add .nx/polygraph to existing .gitignore', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['claude'],
        };

        tree.write('.gitignore', 'node_modules\ndist\n');

        await setupAiAgentsGenerator(tree, options);

        const gitignore = tree.read('.gitignore')?.toString();
        expect(gitignore).toContain('node_modules');
        expect(gitignore).toContain('.nx/polygraph');
      });

      it('should not duplicate if .nx/polygraph is already present', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['claude'],
        };

        tree.write('.gitignore', 'node_modules\n.nx/polygraph\n');

        await setupAiAgentsGenerator(tree, options);

        const gitignore = tree.read('.gitignore')?.toString();
        const matches = gitignore.match(/\.nx\/polygraph/g);
        expect(matches).toHaveLength(1);
      });

      it('should not add if a broader pattern already covers it', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['claude'],
        };

        tree.write('.gitignore', '.nx/\n');

        await setupAiAgentsGenerator(tree, options);

        const gitignore = tree.read('.gitignore')?.toString();
        expect(gitignore).not.toContain('.nx/polygraph');
      });

      it('should add .claude/worktrees to .gitignore', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['claude'],
        };

        tree.write('.gitignore', 'node_modules\ndist\n');

        await setupAiAgentsGenerator(tree, options);

        const gitignore = tree.read('.gitignore')?.toString();
        expect(gitignore).toContain('.claude/worktrees');
      });

      it('should not duplicate if .claude/worktrees is already present', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['claude'],
        };

        tree.write('.gitignore', 'node_modules\n.claude/worktrees\n');

        await setupAiAgentsGenerator(tree, options);

        const gitignore = tree.read('.gitignore')?.toString();
        const matches = gitignore.match(/\.claude\/worktrees/g);
        expect(matches).toHaveLength(1);
      });

      it('should not add .claude/worktrees if a broader pattern already covers it', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['claude'],
        };

        tree.write('.gitignore', '.claude/\n');

        await setupAiAgentsGenerator(tree, options);

        const gitignore = tree.read('.gitignore')?.toString();
        expect(gitignore).not.toContain('.claude/worktrees');
      });

      it('should add .claude/settings.local.json to .gitignore', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['claude'],
        };

        tree.write('.gitignore', 'node_modules\ndist\n');

        await setupAiAgentsGenerator(tree, options);

        const gitignore = tree.read('.gitignore')?.toString();
        expect(gitignore).toContain('.claude/settings.local.json');
      });

      it('should not duplicate if .claude/settings.local.json is already present', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['claude'],
        };

        tree.write('.gitignore', 'node_modules\n.claude/settings.local.json\n');

        await setupAiAgentsGenerator(tree, options);

        const gitignore = tree.read('.gitignore')?.toString();
        const matches = gitignore.match(/\.claude\/settings\.local\.json/g);
        expect(matches).toHaveLength(1);
      });

      it('should not add .claude/settings.local.json if a broader pattern already covers it', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['claude'],
        };

        tree.write('.gitignore', '.claude/\n');

        await setupAiAgentsGenerator(tree, options);

        const gitignore = tree.read('.gitignore')?.toString();
        expect(gitignore).not.toContain('.claude/settings.local.json');
      });
    });

    describe('empty agents array', () => {
      it('should NOT generate any files when agents array is empty', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: [],
        };

        await setupAiAgentsGenerator(tree, options);

        expect(tree.exists('AGENTS.md')).toBe(false);
        expect(tree.exists('CLAUDE.md')).toBe(false);
        expect(tree.exists('.mcp.json')).toBe(false);
        expect(tree.exists('.gemini/settings.json')).toBe(false);
      });

      it('should ignore agents nx no longer supports', async () => {
        await setupAiAgentsGenerator(tree, {
          directory: '.',
          agents: ['copilot', 'gemini'] as any,
        });

        expect(tree.exists('.gemini')).toBe(false);
        expect(tree.exists('.github/skills')).toBe(false);
      });
    });
  });

  describe('rules files', () => {
    it('should not write AGENTS.md, CLAUDE.md or GEMINI.md', async () => {
      await setupAiAgentsGenerator(tree, { directory: '.' });

      expect(tree.exists('AGENTS.md')).toBe(false);
      expect(tree.exists('CLAUDE.md')).toBe(false);
      expect(tree.exists('GEMINI.md')).toBe(false);
      expect(tree.exists('.gemini')).toBe(false);
    });

    it('should remove every Nx block whichever agents are selected', async () => {
      tree.write('AGENTS.md', nxRulesBlock);
      tree.write('GEMINI.md', `# Ours\n\n${nxRulesBlock}`);
      tree.write('CLAUDE.md', nxRulesBlock);
      tree.write(
        '.gemini/settings.json',
        JSON.stringify({ contextFileName: 'docs/AI.md' })
      );
      tree.write('docs/AI.md', `Ours.\n\n${nxRulesBlock}`);

      await setupAiAgentsGenerator(tree, {
        directory: '.',
        agents: ['opencode'],
      });

      expect(tree.exists('AGENTS.md')).toBe(false);
      expect(tree.exists('CLAUDE.md')).toBe(false);
      expect(tree.read('GEMINI.md', 'utf-8')).toEqual('# Ours\n');
      expect(tree.read('docs/AI.md', 'utf-8')).toEqual('Ours.\n');
    });

    it('should remove the Nx blocks even when no agent can be set up', async () => {
      latestPluginVersionSpy.mockResolvedValue(null);
      tree.write('AGENTS.md', nxRulesBlock);

      await setupAiAgentsGenerator(tree, {
        directory: '.',
        agents: ['cursor'],
      });

      expect(tree.exists('AGENTS.md')).toBe(false);
    });

    it('should delete a rules file that only held the Nx guidelines', async () => {
      tree.write(
        'AGENTS.md',
        '<!-- nx configuration start-->\n<!-- Leave the start & end comments to automatically receive updates. -->\n\n# General Guidelines for working with Nx\n\n- use nx\n\n<!-- nx configuration end-->'
      );

      await setupAiAgentsGenerator(tree, {
        directory: '.',
        agents: ['codex'],
      });

      expect(tree.exists('AGENTS.md')).toBe(false);
    });

    it('should remove only the Nx guidelines block from a rules file', async () => {
      tree.write(
        'CLAUDE.md',
        '# My project\n\nOur conventions.\n\n<!-- nx configuration start-->\n## General Guidelines for working with Nx\n<!-- nx configuration end-->\n\n## More of ours\n\nKeep this.\n'
      );

      await setupAiAgentsGenerator(tree, {
        directory: '.',
        agents: ['claude'],
      });

      expect(tree.read('CLAUDE.md', 'utf-8')).toEqual(
        '# My project\n\nOur conventions.\n\n## More of ours\n\nKeep this.\n'
      );
    });
  });

  describe('cursor plugin', () => {
    it('should register the Nx plugin on the branch of the release channel', async () => {
      tree.write(
        '.cursor/settings.json',
        JSON.stringify({ other: true, plugins: { mine: { enabled: true } } })
      );

      await setupAiAgentsGenerator(tree, {
        directory: '.',
        agents: ['cursor'],
      });

      expect(readJson(tree, '.cursor/settings.json')).toEqual({
        other: true,
        plugins: {
          mine: { enabled: true },
          'nx-agent-plugins/nx': {
            enabled: true,
            gitUrl: 'https://github.com/nrwl/nx-ai-agents-config.git',
            gitRef: 'dist/next',
          },
        },
      });
      expect(latestPluginVersionSpy).not.toHaveBeenCalled();
    });

    it('should keep keys users added to the Nx plugin entry', async () => {
      tree.write(
        '.cursor/settings.json',
        JSON.stringify({
          plugins: {
            'nx-agent-plugins/nx': { custom: 'kept' },
          },
        })
      );

      await setupAiAgentsGenerator(tree, {
        directory: '.',
        agents: ['cursor'],
      });

      expect(
        readJson(tree, '.cursor/settings.json').plugins['nx-agent-plugins/nx']
      ).toEqual({
        custom: 'kept',
        enabled: true,
        gitUrl: 'https://github.com/nrwl/nx-ai-agents-config.git',
        gitRef: 'dist/next',
      });
    });

    it('should move a channel branch to the channel nx follows', async () => {
      tree.write(
        '.cursor/settings.json',
        JSON.stringify({
          plugins: {
            'nx-agent-plugins/nx': { enabled: true, gitRef: 'dist/latest' },
          },
        })
      );

      await setupAiAgentsGenerator(tree, {
        directory: '.',
        agents: ['cursor'],
      });

      expect(
        readJson(tree, '.cursor/settings.json').plugins['nx-agent-plugins/nx']
          .gitRef
      ).toEqual('dist/next');
    });

    it('should keep a ref the workspace pinned', async () => {
      tree.write(
        '.cursor/settings.json',
        JSON.stringify({
          plugins: {
            'nx-agent-plugins/nx': { enabled: true, gitRef: 'v2.0.0-beta.1' },
          },
        })
      );

      await setupAiAgentsGenerator(tree, {
        directory: '.',
        agents: ['cursor'],
      });

      expect(
        readJson(tree, '.cursor/settings.json').plugins['nx-agent-plugins/nx']
          .gitRef
      ).toEqual('v2.0.0-beta.1');
    });

    it('should remove copied files that were not edited and keep edited ones', async () => {
      const unedited = '.cursor/agents/ci-monitor-subagent.md';
      const edited = Object.keys(legacyAgentFiles).find(
        (path) => path.startsWith('.cursor/') && path !== unedited
      );
      tree.write(unedited, shippedContent(unedited));
      tree.write(edited, 'my own changes');
      tree.write('.cursor/rules/mine.mdc', 'user rule');

      const callback = await setupAiAgentsGenerator(tree, {
        directory: '.',
        agents: ['cursor'],
      });
      const { messages } = await callback();

      expect(tree.exists(unedited)).toBe(false);
      expect(tree.exists('.cursor/agents')).toBe(false);
      expect(tree.exists(edited)).toBe(true);
      expect(tree.exists('.cursor/rules/mine.mdc')).toBe(true);
      expect(
        messages.find((m) => m.title.startsWith('Kept files'))?.bodyLines
      ).toContain(`- ${edited}`);
    });

    it('should not report edited copies when only checking', async () => {
      const edited = '.cursor/agents/ci-monitor-subagent.md';
      tree.write(edited, 'my own changes');
      tree.write(
        '.cursor/settings.json',
        JSON.stringify({
          plugins: {
            'nx-agent-plugins/nx': {
              enabled: true,
              gitUrl: 'https://github.com/nrwl/nx-ai-agents-config.git',
              gitRef: 'v1.2.3',
            },
          },
        })
      );

      const callback = await setupAiAgentsGenerator(tree, {
        directory: '.',
        agents: ['cursor'],
      });
      const { messages } = await callback(true);

      expect(messages.filter((m) => m.title.startsWith('Kept files'))).toEqual(
        []
      );
    });
  });

  describe('codex plugin', () => {
    it('should enable the Nx plugin for the project', async () => {
      await setupAiAgentsGenerator(tree, {
        directory: '.',
        agents: ['codex'],
      });

      expect(TOML.parse(tree.read('.codex/config.toml', 'utf-8'))).toEqual({
        plugins: { 'nx@nx-agent-plugins': { enabled: true } },
      });
    });

    it('should remove the nx-mcp server and copied subagents but keep user config', async () => {
      const copiedAgent = '.codex/agents/ci-monitor-subagent.toml';
      tree.write(copiedAgent, shippedContent(copiedAgent));
      tree.write(
        '.codex/config.toml',
        `model = "o3"

[mcp_servers."nx-mcp"]
command = "npx"
args = ["nx", "mcp"]

[mcp_servers.other]
command = "other"

[features]
multi_agent = true

[agents.ci-monitor-subagent]
description = "Polls Nx Cloud CI pipeline."
config_file = "agents/ci-monitor-subagent.toml"

[agents.mine]
config_file = "agents/mine.toml"
`
      );

      await setupAiAgentsGenerator(tree, {
        directory: '.',
        agents: ['codex'],
      });

      expect(tree.exists(copiedAgent)).toBe(false);
      expect(TOML.parse(tree.read('.codex/config.toml', 'utf-8'))).toEqual({
        model: 'o3',
        mcp_servers: { other: { command: 'other' } },
        features: { multi_agent: true },
        agents: { mine: { config_file: 'agents/mine.toml' } },
        plugins: { 'nx@nx-agent-plugins': { enabled: true } },
      });
    });

    it('should keep the subagent entry when its copied file was edited', async () => {
      tree.write('.codex/agents/ci-monitor-subagent.toml', 'edited = true');
      tree.write(
        '.codex/config.toml',
        `[agents.ci-monitor-subagent]
config_file = "agents/ci-monitor-subagent.toml"
`
      );

      await setupAiAgentsGenerator(tree, {
        directory: '.',
        agents: ['codex'],
      });

      expect(
        TOML.parse(tree.read('.codex/config.toml', 'utf-8')).agents
      ).toEqual({
        'ci-monitor-subagent': {
          config_file: 'agents/ci-monitor-subagent.toml',
        },
      });
    });

    it('should not rewrite a config that already enables the plugin', async () => {
      const config = `# my comment
[plugins."nx@nx-agent-plugins"]
enabled = true
`;
      tree.write('.codex/config.toml', config);

      await setupAiAgentsGenerator(tree, {
        directory: '.',
        agents: ['codex'],
      });

      expect(tree.read('.codex/config.toml', 'utf-8')).toEqual(config);
    });

    it('should leave an unparseable config untouched and report it', async () => {
      tree.write('.codex/config.toml', 'not [valid toml');

      const callback = await setupAiAgentsGenerator(tree, {
        directory: '.',
        agents: ['codex'],
      });
      const { errors } = await callback(true);

      expect(tree.read('.codex/config.toml', 'utf-8')).toEqual(
        'not [valid toml'
      );
      expect(errors.map((e) => e.title)).toContain(
        'Could not configure the Nx plugin for OpenAI Codex'
      );
    });

    it('should keep copied subagents when the config cannot be parsed', async () => {
      const copiedAgent = '.codex/agents/ci-monitor-subagent.toml';
      tree.write(copiedAgent, shippedContent(copiedAgent));
      tree.write('.codex/config.toml', 'not [valid toml');

      await setupAiAgentsGenerator(tree, {
        directory: '.',
        agents: ['codex'],
      });

      expect(tree.exists(copiedAgent)).toBe(true);
    });

    it('should install the plugin for the user when codex is available', async () => {
      isCodexAvailableSpy.mockReturnValue(true);

      const callback = await setupAiAgentsGenerator(tree, {
        directory: '.',
        agents: ['codex'],
      });
      const { messages, errors } = await callback();

      expect(installCodexPluginSpy).toHaveBeenCalledWith('1.2.3', tree.root);
      expect(errors).toEqual([]);
      expect(messages.map((m) => m.title)).toContain(
        'Installed the Nx plugin for OpenAI Codex'
      );
    });

    it('should report a failed install with the command to run', async () => {
      isCodexAvailableSpy.mockReturnValue(true);
      installCodexPluginSpy.mockReturnValue({ ok: false, error: 'boom' });

      const callback = await setupAiAgentsGenerator(tree, {
        directory: '.',
        agents: ['codex'],
      });
      const { errors } = await callback();

      expect(errors[0].bodyLines).toEqual([
        'boom',
        'Run: npx -y @nx/codex-plugin@1.2.3 install',
      ]);
    });

    it('should explain the install step when codex is not available', async () => {
      const callback = await setupAiAgentsGenerator(tree, {
        directory: '.',
        agents: ['codex'],
      });
      const { messages } = await callback();

      expect(installCodexPluginSpy).not.toHaveBeenCalled();
      expect(messages.map((m) => m.title)).toContain(
        'Install the Nx plugin for OpenAI Codex once per machine'
      );
    });

    it('should only report a missing user install when checking', async () => {
      isCodexAvailableSpy.mockReturnValue(true);

      const callback = await setupAiAgentsGenerator(tree, {
        directory: '.',
        agents: ['codex'],
      });
      const { messages } = await callback(true);

      expect(installCodexPluginSpy).not.toHaveBeenCalled();
      expect(messages.map((m) => m.title)).toEqual([
        'The Nx plugin for OpenAI Codex is not installed for this user',
      ]);
    });

    it('should not reinstall a plugin version that is already installed', async () => {
      isCodexAvailableSpy.mockReturnValue(true);
      isCodexPluginInstalledSpy.mockReturnValue(true);

      const callback = await setupAiAgentsGenerator(tree, {
        directory: '.',
        agents: ['codex'],
      });
      const { messages, errors } = await callback();

      expect(installCodexPluginSpy).not.toHaveBeenCalled();
      expect(errors).toEqual([]);
      expect(messages).toEqual([]);
    });

    it('should report nothing when checking an installed plugin', async () => {
      isCodexAvailableSpy.mockReturnValue(true);
      isCodexPluginInstalledSpy.mockReturnValue(true);

      const callback = await setupAiAgentsGenerator(tree, {
        directory: '.',
        agents: ['codex'],
      });
      const { messages } = await callback(true);

      expect(isCodexPluginInstalledSpy).toHaveBeenCalledWith('1.2.3');
      expect(messages).toEqual([]);
    });
  });

  describe('opencode plugin', () => {
    it('should add the Nx plugin on the channel dist-tag and remove the nx-mcp server', async () => {
      tree.write(
        'opencode.json',
        JSON.stringify({
          $schema: 'https://opencode.ai/config.json',
          plugin: ['other-plugin'],
          mcp: {
            'nx-mcp': { type: 'local', command: ['npx', 'nx', 'mcp'] },
          },
        })
      );

      await setupAiAgentsGenerator(tree, {
        directory: '.',
        agents: ['opencode'],
      });

      expect(readJson(tree, 'opencode.json')).toEqual({
        $schema: 'https://opencode.ai/config.json',
        plugin: ['other-plugin', '@nx/opencode-plugin@next'],
      });
      expect(latestPluginVersionSpy).not.toHaveBeenCalled();
    });

    it('should move an entry on a dist-tag to the channel and keep its options', async () => {
      tree.write(
        'opencode.json',
        JSON.stringify({
          plugin: [
            'other-plugin',
            ['@nx/opencode-plugin@latest', { verbose: true }],
          ],
        })
      );

      await setupAiAgentsGenerator(tree, {
        directory: '.',
        agents: ['opencode'],
      });

      expect(readJson(tree, 'opencode.json').plugin).toEqual([
        'other-plugin',
        ['@nx/opencode-plugin@next', { verbose: true }],
      ]);
    });

    it('should keep an entry pinned to a version and drop duplicates', async () => {
      tree.write(
        'opencode.json',
        JSON.stringify({
          plugin: [
            ['@nx/opencode-plugin@0.9.0-beta.1', { verbose: true }],
            'other-plugin',
            '@nx/opencode-plugin',
          ],
        })
      );

      await setupAiAgentsGenerator(tree, {
        directory: '.',
        agents: ['opencode'],
      });

      expect(readJson(tree, 'opencode.json').plugin).toEqual([
        ['@nx/opencode-plugin@0.9.0-beta.1', { verbose: true }],
        'other-plugin',
      ]);
    });

    it('should keep other MCP servers', async () => {
      tree.write(
        'opencode.json',
        JSON.stringify({
          mcp: {
            'nx-mcp': { type: 'local', command: ['npx', 'nx', 'mcp'] },
            mine: { type: 'local', command: ['mine'] },
          },
        })
      );

      await setupAiAgentsGenerator(tree, {
        directory: '.',
        agents: ['opencode'],
      });

      expect(readJson(tree, 'opencode.json')).toEqual({
        mcp: { mine: { type: 'local', command: ['mine'] } },
        plugin: ['@nx/opencode-plugin@next'],
      });
    });

    it('should remove copied files', async () => {
      const copied = Object.keys(legacyAgentFiles).find((path) =>
        path.startsWith('.opencode/')
      );
      tree.write(copied, shippedContent(copied));

      await setupAiAgentsGenerator(tree, {
        directory: '.',
        agents: ['opencode'],
      });

      expect(tree.exists(copied)).toBe(false);
      expect(tree.exists('.opencode')).toBe(false);
    });
  });

  describe('Copilot and Gemini setups', () => {
    it('should remove the Gemini MCP server and the settings file when nothing else is left', async () => {
      tree.write(
        '.gemini/settings.json',
        JSON.stringify({
          mcpServers: { 'nx-mcp': { command: 'npx', args: ['nx', 'mcp'] } },
        })
      );

      await setupAiAgentsGenerator(tree, {
        directory: '.',
        agents: ['claude'],
      });

      expect(tree.exists('.gemini')).toBe(false);
    });

    it('should keep other Gemini settings', async () => {
      tree.write(
        '.gemini/settings.json',
        JSON.stringify({
          theme: 'dark',
          contextFileName: 'AGENTS.md',
          mcpServers: {
            'nx-mcp': { command: 'npx' },
            mine: { command: 'mine' },
          },
        })
      );
      tree.write('AGENTS.md', `# Ours\n\n${nxRulesBlock}`);

      await setupAiAgentsGenerator(tree, {
        directory: '.',
        agents: ['claude'],
      });

      // AGENTS.md held Nx guidelines, so nx pointed Gemini at it
      expect(readJson(tree, '.gemini/settings.json')).toEqual({
        theme: 'dark',
        mcpServers: { mine: { command: 'mine' } },
      });
      expect(tree.read('AGENTS.md', 'utf-8')).toEqual('# Ours\n');
    });

    it('should keep a contextFileName pointing at a user-written AGENTS.md', async () => {
      tree.write(
        '.gemini/settings.json',
        JSON.stringify({ contextFileName: 'AGENTS.md' })
      );
      tree.write('AGENTS.md', '# Ours\n');

      await setupAiAgentsGenerator(tree, {
        directory: '.',
        agents: ['claude'],
      });

      expect(readJson(tree, '.gemini/settings.json')).toEqual({
        contextFileName: 'AGENTS.md',
      });
    });

    it('should remove copies for Copilot, Gemini and the shared skills on any run', async () => {
      const copies = [
        '.github/skills/nx-workspace/SKILL.md',
        '.gemini/commands/monitor-ci.toml',
        '.agents/skills/nx-workspace/SKILL.md',
      ];
      for (const copy of copies) {
        tree.write(copy, shippedContent(copy));
      }
      tree.write('.github/workflows/ci.yml', 'on: push');

      await setupAiAgentsGenerator(tree, {
        directory: '.',
        agents: ['claude'],
      });

      for (const copy of copies) {
        expect(tree.exists(copy)).toBe(false);
      }
      expect(tree.exists('.gemini')).toBe(false);
      expect(tree.exists('.agents')).toBe(false);
      expect(tree.exists('.github/workflows/ci.yml')).toBe(true);
    });

    it('should keep and report edited copies', async () => {
      tree.write('.github/skills/nx-workspace/SKILL.md', 'my own changes');

      const callback = await setupAiAgentsGenerator(tree, {
        directory: '.',
        agents: ['claude'],
      });
      const { messages } = await callback();

      expect(tree.exists('.github/skills/nx-workspace/SKILL.md')).toBe(true);
      expect(
        messages.find((m) => m.title.startsWith('Kept files'))?.bodyLines
      ).toContain('- .github/skills/nx-workspace/SKILL.md');
    });
  });
});
