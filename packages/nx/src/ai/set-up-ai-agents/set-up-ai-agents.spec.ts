import type { MockInstance } from 'vitest';
import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import { Tree } from '../../generators/tree';

import { setupAiAgentsGenerator } from './set-up-ai-agents';
import { SetupAiAgentsGeneratorSchema } from './schema';
import { readJson, updateJson } from '../../generators/utils/json';
import { NX_ALLOWLIST_ROOTS } from '../constants';
import * as installedNxVersionUtils from '../../utils/installed-nx-version';
import * as cloneModule from '../clone-ai-config-repo';
import { logger } from '../../utils/logger';
import { DirectoryRefusedError } from '../../utils/owned-private-dir';
import * as provenance from '../../utils/provenance';
import * as packageJsonUtils from '../../utils/package-json';
import * as fs from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    existsSync: vi
      .fn()
      .mockImplementation((...args: any[]) => actual.existsSync(...args)),
    readFileSync: vi
      .fn()
      .mockImplementation((...args: any[]) => actual.readFileSync(...args)),
  };
});

function setAnalytics(tree: Tree, analytics: boolean) {
  updateJson(tree, 'nx.json', (json) => ({ ...json, analytics }));
}

describe('setup-ai-agents generator', () => {
  let tree: Tree;
  let getInstalledNxVersionSpy: MockInstance;

  beforeEach(() => {
    // No formatter: these assertions compare against the exact string the
    // generator builds, so any formatting in the loop breaks them.
    tree = createTreeWithEmptyWorkspace({ formatter: 'none' });
    // Use local implementation instead of fetching from latest
    process.env.NX_AI_FILES_USE_LOCAL = 'true';

    // Mock getInstalledNxVersion to return Nx 22+ by default
    // This ensures existing tests pass by defaulting to the new format
    getInstalledNxVersionSpy = vi
      .spyOn(installedNxVersionUtils, 'getInstalledNxVersion')
      .mockReturnValue('22.0.0');
  });

  afterEach(() => {
    delete process.env.NX_AI_FILES_USE_LOCAL;
    if (getInstalledNxVersionSpy) {
      getInstalledNxVersionSpy.mockRestore();
    }
  });

  it('should use specified directory', async () => {
    const options: SetupAiAgentsGeneratorSchema = {
      directory: 'custom-dir',
    };

    await setupAiAgentsGenerator(tree, options);

    expect(tree.exists('custom-dir/.claude/settings.json')).toBe(true);
    expect(tree.exists('custom-dir/.gemini/settings.json')).toBe(true);
  });

  it('installs the exact version whose provenance was verified', async () => {
    delete process.env.NX_AI_FILES_USE_LOCAL;
    const provenanceSpy = vi
      .spyOn(provenance, 'resolveVersionWithProvenance')
      .mockResolvedValue('1.0.0');
    const installSpy = vi
      .spyOn(packageJsonUtils, 'installPackageToTmp')
      .mockImplementation(() => {
        throw new Error('stub: no install in tests');
      });

    try {
      await setupAiAgentsGenerator(tree, { directory: '.' });

      expect(provenanceSpy).toHaveBeenCalledWith('nx', 'latest', tree.root);
      expect(installSpy).toHaveBeenCalledWith('nx', '1.0.0', expect.anything());
    } finally {
      provenanceSpy.mockRestore();
      installSpy.mockRestore();
    }
  });

  describe('rules files', () => {
    const rulesFiles = ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md'];

    it('should not create rules files', async () => {
      await setupAiAgentsGenerator(tree, { directory: '.' });

      for (const file of rulesFiles) {
        expect(tree.exists(file)).toBe(false);
      }
    });

    it('should leave rules files without an Nx block untouched', async () => {
      const existing = '# My Project\n\nSome content\n';
      for (const file of rulesFiles) {
        tree.write(file, existing);
      }

      await setupAiAgentsGenerator(tree, { directory: '.' });

      for (const file of rulesFiles) {
        expect(tree.read(file, 'utf-8')).toEqual(existing);
      }
    });

    it('should remove the Nx block older versions wrote', async () => {
      const nxBlock =
        '<!-- nx configuration start-->\nOutdated\n<!-- nx configuration end-->';
      tree.write('custom-dir/AGENTS.md', `# My Project\n\n${nxBlock}\n`);
      tree.write('custom-dir/CLAUDE.md', `${nxBlock}\n`);

      await setupAiAgentsGenerator(tree, {
        directory: 'custom-dir',
        agents: ['claude'],
      });

      expect(tree.read('custom-dir/AGENTS.md', 'utf-8')).toEqual(
        '# My Project\n'
      );
      expect(tree.exists('custom-dir/CLAUDE.md')).toBe(false);
    });
  });

  describe('agent-specific file generation', () => {
    describe('claude', () => {
      it('should NOT generate claude files when claude is not in agents array', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['gemini'],
        };

        await setupAiAgentsGenerator(tree, options);

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
          },
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
          },
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
        });
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

    describe('gemini', () => {
      it('should generate .gemini/settings.json when gemini is specified', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['gemini'],
        };

        await setupAiAgentsGenerator(tree, options);

        expect(tree.exists('.gemini/settings.json')).toBe(true);
        // Should NOT generate claude files when only gemini is specified
        expect(tree.exists('.claude/settings.json')).toBe(false);
        expect(tree.exists('.mcp.json')).toBe(false);
      });

      it('should NOT generate .gemini/settings.json when gemini is not in agents array', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['claude'],
        };

        await setupAiAgentsGenerator(tree, options);

        expect(tree.exists('.gemini/settings.json')).toBe(false);
      });

      it('should create .gemini/settings.json with nx-mcp server when file does not exist', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
        };

        await setupAiAgentsGenerator(tree, options);

        expect(tree.exists('.gemini/settings.json')).toBe(true);
        const config = JSON.parse(
          tree.read('.gemini/settings.json')?.toString() ?? '{}'
        );
        expect(config.mcpServers['nx-mcp']).toEqual({
          type: 'stdio',
          command: 'npx',
          args: ['nx', 'mcp'],
        });
      });

      it('should add nx-mcp server to existing .gemini/settings.json', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
        };

        // Create existing config
        tree.write(
          '.gemini/settings.json',
          JSON.stringify(
            {
              someConfig: 'value',
              mcpServers: {
                'existing-server': {
                  type: 'stdio',
                  command: 'existing',
                  args: ['args'],
                },
              },
            },
            null,
            2
          )
        );

        await setupAiAgentsGenerator(tree, options);

        const config = JSON.parse(
          tree.read('.gemini/settings.json')?.toString() ?? '{}'
        );
        expect(config.someConfig).toBe('value');
        expect(config.mcpServers['existing-server']).toBeDefined();
        expect(config.mcpServers['nx-mcp']).toEqual({
          type: 'stdio',
          command: 'npx',
          args: ['nx', 'mcp'],
        });
      });

      it('should preserve an existing contextFileName', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
        };

        // Create existing GEMINI.md file
        tree.write('GEMINI.md', '# Existing Gemini configuration');

        // Create existing .gemini/settings.json with custom contextFileName
        tree.write(
          '.gemini/settings.json',
          JSON.stringify(
            {
              contextFileName: 'GEMINI.md',
              mcpServers: {
                'existing-server': {
                  type: 'stdio',
                  command: 'existing',
                  args: ['args'],
                },
              },
            },
            null,
            2
          )
        );

        await setupAiAgentsGenerator(tree, options);

        const config = JSON.parse(
          tree.read('.gemini/settings.json')?.toString() ?? '{}'
        );
        // Should preserve the existing contextFileName
        expect(config.contextFileName).toBe('GEMINI.md');
        // Should still add nx-mcp server
        expect(config.mcpServers['nx-mcp']).toEqual({
          type: 'stdio',
          command: 'npx',
          args: ['nx', 'mcp'],
        });
      });

      it('should not set contextFileName', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
        };

        await setupAiAgentsGenerator(tree, options);

        const config = JSON.parse(
          tree.read('.gemini/settings.json')?.toString() ?? '{}'
        );
        expect(config.contextFileName).toBeUndefined();
        expect(config.mcpServers['nx-mcp']).toEqual({
          type: 'stdio',
          command: 'npx',
          args: ['nx', 'mcp'],
        });
      });

      it('should delete .gemini/skills that also exist in .agents/skills', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['gemini'],
        };

        // Simulate shared .agents/skills (the new location)
        tree.write(
          '.agents/skills/nx-workspace/SKILL.md',
          '# Nx Workspace Skill'
        );
        tree.write(
          '.agents/skills/nx-generate/SKILL.md',
          '# Nx Generate Skill'
        );

        // Simulate legacy .gemini/skills with matching + user-created skills
        tree.write(
          '.gemini/skills/nx-workspace/skill.md',
          '# Legacy Nx Workspace'
        );
        tree.write(
          '.gemini/skills/nx-generate/skill.md',
          '# Legacy Nx Generate'
        );
        tree.write(
          '.gemini/skills/my-custom-skill/skill.md',
          '# My Custom Skill'
        );

        await setupAiAgentsGenerator(tree, options);

        // Migrated skills should be deleted
        expect(tree.exists('.gemini/skills/nx-workspace')).toBe(false);
        expect(tree.exists('.gemini/skills/nx-generate')).toBe(false);
        // User-created skill should be preserved
        expect(tree.exists('.gemini/skills/my-custom-skill/skill.md')).toBe(
          true
        );
        // Other .gemini files should still exist
        expect(tree.exists('.gemini/settings.json')).toBe(true);
      });

      it('should not delete .gemini/skills when .agents/skills does not exist', async () => {
        // Mock getAiConfigRepoPath to fail so .agents/skills is not created
        const spy = vi
          .spyOn(cloneModule, 'getAiConfigRepoPath')
          .mockImplementation(() => {
            throw new Error('no network');
          });

        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['gemini'],
        };

        // Only legacy skills, no shared .agents/skills
        tree.write(
          '.gemini/skills/nx-workspace/skill.md',
          '# Legacy Nx Workspace'
        );

        await setupAiAgentsGenerator(tree, options);

        // Should be preserved since there's no .agents/skills to compare against
        expect(tree.exists('.gemini/skills/nx-workspace/skill.md')).toBe(true);

        spy.mockRestore();
      });

      it('should not error when .gemini/skills does not exist', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['gemini'],
        };

        await setupAiAgentsGenerator(tree, options);

        expect(tree.exists('.gemini/skills')).toBe(false);
        expect(tree.exists('.gemini/settings.json')).toBe(true);
      });
    });

    describe('multiple agents', () => {
      it('should generate files for both claude and gemini when both are specified', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['claude', 'gemini'],
        };

        await setupAiAgentsGenerator(tree, options);

        expect(tree.exists('.claude/settings.json')).toBe(true);
        expect(tree.exists('.gemini/settings.json')).toBe(true);
        // .mcp.json should NOT be created - Claude uses plugin, Gemini uses .gemini/settings.json
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
    });

    describe('MCP config extra args preservation', () => {
      it('should preserve extra args in gemini MCP config', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['gemini'],
        };

        tree.write(
          '.gemini/settings.json',
          JSON.stringify({
            mcpServers: {
              'nx-mcp': {
                type: 'stdio',
                command: 'npx',
                args: ['nx', 'mcp', '--transport', 'http'],
              },
            },
          })
        );

        await setupAiAgentsGenerator(tree, options);

        const config = JSON.parse(
          tree.read('.gemini/settings.json')?.toString() ?? '{}'
        );
        expect(config.mcpServers['nx-mcp'].args).toEqual([
          'nx',
          'mcp',
          '--transport',
          'http',
        ]);
      });

      it('should preserve multiple extra args in gemini MCP config', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['gemini'],
        };

        tree.write(
          '.gemini/settings.json',
          JSON.stringify({
            mcpServers: {
              'nx-mcp': {
                type: 'stdio',
                command: 'npx',
                args: [
                  'nx',
                  'mcp',
                  '--experimental-polygraph',
                  '--transport',
                  'http',
                ],
              },
            },
          })
        );

        await setupAiAgentsGenerator(tree, options);

        const config = JSON.parse(
          tree.read('.gemini/settings.json')?.toString() ?? '{}'
        );
        expect(config.mcpServers['nx-mcp'].args).toEqual([
          'nx',
          'mcp',
          '--experimental-polygraph',
          '--transport',
          'http',
        ]);
      });

      it('should preserve extra args when upgrading from Nx 21 to 22 (gemini)', async () => {
        getInstalledNxVersionSpy.mockReturnValue('22.0.0');

        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['gemini'],
        };

        // Simulate old Nx 21 config with extra args
        tree.write(
          '.gemini/settings.json',
          JSON.stringify({
            mcpServers: {
              'nx-mcp': {
                type: 'stdio',
                command: 'npx',
                args: ['nx-mcp', '--minimal', '--transport', 'http'],
              },
            },
          })
        );

        await setupAiAgentsGenerator(tree, options);

        const config = JSON.parse(
          tree.read('.gemini/settings.json')?.toString() ?? '{}'
        );
        // Should update base args to v22 format but preserve extras
        expect(config.mcpServers['nx-mcp'].args).toEqual([
          'nx',
          'mcp',
          '--minimal',
          '--transport',
          'http',
        ]);
      });

      it('should preserve extra args from versioned nx-mcp base command (gemini)', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['gemini'],
        };

        tree.write(
          '.gemini/settings.json',
          JSON.stringify({
            mcpServers: {
              'nx-mcp': {
                type: 'stdio',
                command: 'npx',
                args: ['nx-mcp@latest', '--experimental-polygraph'],
              },
            },
          })
        );

        await setupAiAgentsGenerator(tree, options);

        const config = JSON.parse(
          tree.read('.gemini/settings.json')?.toString() ?? '{}'
        );
        expect(config.mcpServers['nx-mcp'].args).toEqual([
          'nx',
          'mcp',
          '--experimental-polygraph',
        ]);
      });

      it('should preserve extra args in opencode MCP command', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['opencode'],
        };

        tree.write(
          'opencode.json',
          JSON.stringify({
            mcp: {
              'nx-mcp': {
                type: 'local',
                command: [
                  'npx',
                  'nx',
                  'mcp',
                  '--experimental-polygraph',
                  '--transport',
                  'http',
                ],
                enabled: true,
              },
            },
          })
        );

        await setupAiAgentsGenerator(tree, options);

        const config = JSON.parse(
          tree.read('opencode.json')?.toString() ?? '{}'
        );
        expect(config.mcp['nx-mcp'].command).toEqual([
          'npx',
          'nx',
          'mcp',
          '--experimental-polygraph',
          '--transport',
          'http',
        ]);
      });

      it('should not add extra args when none exist in existing config', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['gemini'],
        };

        tree.write(
          '.gemini/settings.json',
          JSON.stringify({
            mcpServers: {
              'nx-mcp': {
                type: 'stdio',
                command: 'npx',
                args: ['nx', 'mcp'],
              },
            },
          })
        );

        await setupAiAgentsGenerator(tree, options);

        const config = JSON.parse(
          tree.read('.gemini/settings.json')?.toString() ?? '{}'
        );
        expect(config.mcpServers['nx-mcp'].args).toEqual(['nx', 'mcp']);
      });
    });

    describe('codex config from generated template', () => {
      let getAiConfigRepoPathSpy: MockInstance;
      let existsSyncSpy: MockInstance;
      let readFileSyncSpy: MockInstance;

      const generatedConfig = `[mcp_servers."nx-mcp"]
command = "npx"
args = ["nx-mcp@latest", "--minimal"]

[features]
multi_agent = true

[agents.ci-monitor-subagent]
description = "Polls Nx Cloud CI pipeline."
config_file = ".codex/agents/ci-monitor-subagent.toml"
`;

      beforeEach(() => {
        getAiConfigRepoPathSpy = vi
          .spyOn(cloneModule, 'getAiConfigRepoPath')
          .mockReturnValue('/fake/repo');

        const originalExistsSync = fs.existsSync;
        existsSyncSpy = vi
          .spyOn(fs, 'existsSync')
          .mockImplementation((path: any) => {
            if (
              typeof path === 'string' &&
              path.includes('/fake/repo/generated/.codex/config.toml')
            ) {
              return true;
            }
            if (
              typeof path === 'string' &&
              path.includes('/fake/repo/generated/.codex/agents')
            ) {
              return false; // No agent files to copy for simplicity
            }
            if (
              typeof path === 'string' &&
              path.includes('/fake/repo/generated/')
            ) {
              return false; // No other generated dirs
            }
            return originalExistsSync(path);
          });

        const originalReadFileSync = fs.readFileSync;
        readFileSyncSpy = vi
          .spyOn(fs, 'readFileSync')
          .mockImplementation((path: any, ...args: any[]) => {
            if (
              typeof path === 'string' &&
              path.includes('/fake/repo/generated/.codex/config.toml')
            ) {
              return generatedConfig;
            }
            return originalReadFileSync(path, ...args);
          });
      });

      afterEach(() => {
        getAiConfigRepoPathSpy.mockRestore();
        existsSyncSpy.mockRestore();
        readFileSyncSpy.mockRestore();
      });

      it('should write generated config.toml with adjusted MCP args for Nx 22+', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['codex'],
        };

        await setupAiAgentsGenerator(tree, options);

        const content = tree.read('.codex/config.toml')?.toString();
        expect(content).toContain('[agents.ci-monitor-subagent]');
        expect(content).toContain('multi_agent = true');
        // MCP args should be adjusted to Nx 22+ format
        expect(content).toMatch(/"nx"/);
        expect(content).toMatch(/"mcp"/);
        // Should NOT contain the original nx-mcp@latest args
        expect(content).not.toContain('nx-mcp@latest');
      });

      it('should write generated config.toml with adjusted MCP args for Nx < 22', async () => {
        getInstalledNxVersionSpy.mockReturnValue('21.0.0');

        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['codex'],
        };

        await setupAiAgentsGenerator(tree, options);

        const content = tree.read('.codex/config.toml')?.toString();
        expect(content).toMatch(/"nx-mcp"/);
        expect(content).toContain('[agents.ci-monitor-subagent]');
      });

      it('should update existing sections and preserve user content', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['codex'],
        };

        // Pre-existing config with user content and old MCP config
        tree.write(
          '.codex/config.toml',
          `sandbox_mode = "read-only"

[mcp_servers."nx-mcp"]
command = "npx"
args = ["nx-mcp"]
`
        );

        await setupAiAgentsGenerator(tree, options);

        const content = tree.read('.codex/config.toml')?.toString();
        // User content preserved
        expect(content).toContain('sandbox_mode');
        expect(content).toContain('read-only');
        // MCP args updated to Nx 22+ format
        expect(content).toMatch(/"nx"/);
        expect(content).toMatch(/"mcp"/);
        // New sections added
        expect(content).toContain('[agents.ci-monitor-subagent]');
        expect(content).toContain('multi_agent = true');
      });

      it('should preserve extra MCP args from existing config', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['codex'],
        };

        tree.write(
          '.codex/config.toml',
          `[mcp_servers."nx-mcp"]
command = "npx"
args = ["nx", "mcp", "--experimental-polygraph", "--transport", "http"]
`
        );

        await setupAiAgentsGenerator(tree, options);

        const content = tree.read('.codex/config.toml')?.toString();
        expect(content).toContain('--experimental-polygraph');
        expect(content).toContain('--transport');
        expect(content).toContain('http');
      });

      it('should not set multi_agent when user explicitly set it to false', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['codex'],
        };

        tree.write(
          '.codex/config.toml',
          `[features]
multi_agent = false
`
        );

        await setupAiAgentsGenerator(tree, options);

        const content = tree.read('.codex/config.toml')?.toString();
        // User's explicit false should be preserved
        expect(content).toContain('multi_agent = false');
        expect(content).not.toContain('multi_agent = true');
        // Agent definitions should still be added
        expect(content).toContain('[agents.ci-monitor-subagent]');
      });

      it('should append config to file with unrelated user content', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['codex'],
        };

        // User config with no nx content
        tree.write(
          '.codex/config.toml',
          `model = "gpt-5-codex"
sandbox_mode = "read-only"
`
        );

        await setupAiAgentsGenerator(tree, options);

        const content = tree.read('.codex/config.toml')?.toString();
        // User content preserved
        expect(content).toContain('gpt-5-codex');
        expect(content).toContain('read-only');
        // Nx config added
        expect(content).toContain('[agents.ci-monitor-subagent]');
        expect(content).toContain('nx-mcp');
      });

      it('should fall back to hardcoded config when repo is unavailable', async () => {
        getAiConfigRepoPathSpy.mockImplementation(() => {
          throw new Error('Network error');
        });

        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['codex'],
        };

        await setupAiAgentsGenerator(tree, options);

        const content = tree.read('.codex/config.toml')?.toString();
        // Should have basic MCP config (hardcoded fallback uses double quotes)
        expect(content).toContain('[mcp_servers."nx-mcp"]');
        expect(content).toContain('args = ["nx", "mcp"]');
        // Should NOT have agents (fallback doesn't include them)
        expect(content).not.toContain('[agents');
      });

      it('warns when the repo cache directory is refused', async () => {
        getAiConfigRepoPathSpy.mockImplementation(() => {
          throw new DirectoryRefusedError({
            kind: 'foreign-owner',
            dir: '/tmp/.nx',
            uid: 1234,
          });
        });
        const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

        await setupAiAgentsGenerator(tree, {
          directory: '.',
          agents: ['codex'],
        });

        expect(warn).toHaveBeenCalledWith(expect.stringContaining('/tmp/.nx'));
        warn.mockRestore();
      });

      it('does not warn when the repo is unreachable', async () => {
        getAiConfigRepoPathSpy.mockImplementation(() => {
          throw new Error('Network error');
        });
        const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

        await setupAiAgentsGenerator(tree, {
          directory: '.',
          agents: ['codex'],
        });

        expect(warn).not.toHaveBeenCalled();
        warn.mockRestore();
      });
    });

    describe('ai-config repo artifacts', () => {
      let repoDir: string;
      let getAiConfigRepoPathSpy: MockInstance;
      let previousExistsSync: typeof fs.existsSync | undefined;
      let previousReadFileSync: typeof fs.readFileSync | undefined;

      beforeEach(async () => {
        const actualFs = await vi.importActual<typeof fs>('fs');
        previousExistsSync = vi.mocked(fs.existsSync).getMockImplementation();
        previousReadFileSync = vi
          .mocked(fs.readFileSync)
          .getMockImplementation() as typeof fs.readFileSync | undefined;
        vi.mocked(fs.existsSync).mockImplementation(actualFs.existsSync);
        vi.mocked(fs.readFileSync).mockImplementation(actualFs.readFileSync);
        repoDir = fs.mkdtempSync(join(tmpdir(), 'nx-ai-config-spec-'));
        const skillDir = join(repoDir, 'generated/.agents/skills/demo');
        fs.mkdirSync(skillDir, { recursive: true });
        fs.writeFileSync(
          join(skillDir, 'SKILL.md'),
          '# Demo\n<% globalThis.__nxAiConfigRendered = true %>\n<%= 1 + 1 %>\n'
        );
        const opencodeDir = join(repoDir, 'generated/.opencode/commands');
        fs.mkdirSync(opencodeDir, { recursive: true });
        fs.writeFileSync(join(opencodeDir, 'demo.md'), 'Run <%= name %>\n');

        getAiConfigRepoPathSpy = vi
          .spyOn(cloneModule, 'getAiConfigRepoPath')
          .mockReturnValue(repoDir);
      });

      afterEach(() => {
        getAiConfigRepoPathSpy.mockRestore();
        vi.mocked(fs.existsSync).mockImplementation(previousExistsSync);
        vi.mocked(fs.readFileSync).mockImplementation(previousReadFileSync);
        fs.rmSync(repoDir, { recursive: true, force: true });
        delete (globalThis as any).__nxAiConfigRendered;
      });

      it('should copy files verbatim without evaluating template tags', async () => {
        await setupAiAgentsGenerator(tree, {
          directory: '.',
          agents: ['cursor', 'opencode'],
        });

        expect((globalThis as any).__nxAiConfigRendered).toBeUndefined();
        expect(tree.read('.agents/skills/demo/SKILL.md', 'utf-8')).toEqual(
          '# Demo\n<% globalThis.__nxAiConfigRendered = true %>\n<%= 1 + 1 %>\n'
        );
        expect(tree.read('.opencode/commands/demo.md', 'utf-8')).toEqual(
          'Run <%= name %>\n'
        );
      });
    });

    describe('Nx version-specific MCP configuration', () => {
      it('should use "nx mcp" for Nx 22+ (gemini)', async () => {
        getInstalledNxVersionSpy.mockReturnValue('22.0.0');

        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['gemini'],
        };

        await setupAiAgentsGenerator(tree, options);

        const config = JSON.parse(
          tree.read('.gemini/settings.json')?.toString() ?? '{}'
        );
        expect(config.mcpServers['nx-mcp']).toEqual({
          type: 'stdio',
          command: 'npx',
          args: ['nx', 'mcp'],
        });
      });

      it('should use "nx-mcp" for Nx < 22 (gemini)', async () => {
        getInstalledNxVersionSpy.mockReturnValue('21.0.0');

        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['gemini'],
        };

        await setupAiAgentsGenerator(tree, options);

        const config = JSON.parse(
          tree.read('.gemini/settings.json')?.toString() ?? '{}'
        );
        expect(config.mcpServers['nx-mcp']).toEqual({
          type: 'stdio',
          command: 'npx',
          args: ['nx-mcp'],
        });
      });

      it('should use "nx mcp" as fallback when version cannot be determined (gemini)', async () => {
        getInstalledNxVersionSpy.mockReturnValue(null);

        // Mock readFileSync to fail only for package.json so it falls back to default version
        // but allow other file reads (needed for generateFiles)
        const originalReadFileSync = fs.readFileSync;
        const readFileSyncSpy = vi
          .spyOn(fs, 'readFileSync')
          .mockImplementation((path: any, ...args: any[]) => {
            if (
              typeof path === 'string' &&
              path.endsWith('package.json') &&
              !path.includes('node_modules')
            ) {
              throw new Error('File not found');
            }
            return originalReadFileSync(path, ...args);
          });

        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['gemini'],
        };

        await setupAiAgentsGenerator(tree, options);

        const config = JSON.parse(
          tree.read('.gemini/settings.json')?.toString() ?? '{}'
        );
        expect(config.mcpServers['nx-mcp']).toEqual({
          type: 'stdio',
          command: 'npx',
          args: ['nx', 'mcp'],
        });

        readFileSyncSpy.mockRestore();
      });

      it('should use "nx mcp" for Nx 23+ (gemini)', async () => {
        getInstalledNxVersionSpy.mockReturnValue('23.1.0');

        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['gemini'],
        };

        await setupAiAgentsGenerator(tree, options);

        const config = JSON.parse(
          tree.read('.gemini/settings.json')?.toString() ?? '{}'
        );
        expect(config.mcpServers['nx-mcp']).toEqual({
          type: 'stdio',
          command: 'npx',
          args: ['nx', 'mcp'],
        });
      });
    });
  });
});
