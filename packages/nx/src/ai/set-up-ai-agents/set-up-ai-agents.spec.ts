import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import { Tree } from '../../generators/tree';

import { setupAiAgentsGenerator } from './set-up-ai-agents';
import { SetupAiAgentsGeneratorSchema } from './schema';
import { readJson } from '../../generators/utils/json';
import { getAgentRulesWrapped } from '../constants';
import * as packageJsonUtils from '../../utils/package-json';
import * as fs from 'fs';

describe('setup-ai-agents generator', () => {
  let tree: Tree;
  let readModulePackageJsonSpy: jest.SpyInstance;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    // Use local implementation instead of fetching from latest
    process.env.NX_AI_FILES_USE_LOCAL = 'true';

    // Mock readModulePackageJson to return Nx 22+ by default
    // This ensures existing tests pass by defaulting to the new format
    readModulePackageJsonSpy = jest
      .spyOn(packageJsonUtils, 'readModulePackageJson')
      .mockReturnValue({
        packageJson: { name: 'nx', version: '22.0.0' },
        path: '/fake/path/package.json',
      });
  });

  afterEach(() => {
    delete process.env.NX_AI_FILES_USE_LOCAL;
    if (readModulePackageJsonSpy) {
      readModulePackageJsonSpy.mockRestore();
    }
  });

  it('should respect writeNxCloudRules option', async () => {
    const options: SetupAiAgentsGeneratorSchema = {
      directory: '.',
      writeNxCloudRules: true,
    };

    await setupAiAgentsGenerator(tree, options);

    const claudeContent = tree.read('CLAUDE.md')?.toString();
    // The template should include Nx guidelines
    expect(claudeContent).toContain('# General Guidelines for working with Nx');
  });

  it('should use specified directory', async () => {
    const options: SetupAiAgentsGeneratorSchema = {
      directory: 'custom-dir',
    };

    await setupAiAgentsGenerator(tree, options);

    expect(tree.exists('custom-dir/CLAUDE.md')).toBe(true);
    expect(tree.exists('custom-dir/AGENTS.md')).toBe(true);
    expect(tree.exists('custom-dir/.claude/settings.json')).toBe(true);
    expect(tree.exists('custom-dir/.gemini/settings.json')).toBe(true);
  });

  describe('outdated rules update', () => {
    it('should append to existing AGENTS.md when no nx rules exist', async () => {
      const options: SetupAiAgentsGeneratorSchema = {
        directory: '.',
        writeNxCloudRules: true,
        agents: ['codex'],
      };

      const existing = '# existing agents content';

      tree.write('AGENTS.md', existing);

      await setupAiAgentsGenerator(tree, options);

      const content = tree.read('AGENTS.md')?.toString();
      // When appending to existing content with an h1 header, use h2 header
      expect(content).toEqual(
        existing +
          '\n\n' +
          getAgentRulesWrapped({ writeNxCloudRules: true, useH1: false })
      );
    });

    it('should use h1 when appending to AGENTS.md without existing h1 header', async () => {
      const options: SetupAiAgentsGeneratorSchema = {
        directory: '.',
        writeNxCloudRules: true,
        agents: ['codex'],
      };

      // Content without an h1 header (just plain text)
      const existing = 'Some existing content without a header';

      tree.write('AGENTS.md', existing);

      await setupAiAgentsGenerator(tree, options);

      const content = tree.read('AGENTS.md')?.toString();
      // When appending to existing content without an h1, use h1 header
      expect(content).toEqual(
        existing +
          '\n\n' +
          getAgentRulesWrapped({ writeNxCloudRules: true, useH1: true })
      );
    });

    it('should NOT modify AGENTS.md when up-to-date nx rules exist', async () => {
      const options: SetupAiAgentsGeneratorSchema = {
        directory: '.',
        writeNxCloudRules: true,
        agents: ['codex'],
      };

      const existing = getAgentRulesWrapped({
        writeNxCloudRules: true,
        useH1: true,
      });

      tree.write('AGENTS.md', existing);

      await setupAiAgentsGenerator(tree, options);

      const content = tree.read('AGENTS.md')?.toString();
      expect(content).toEqual(existing);
    });

    it('should NOT modify AGENTS.md when up-to-date h2 nx rules exist alongside an external h1', async () => {
      const options: SetupAiAgentsGeneratorSchema = {
        directory: '.',
        writeNxCloudRules: true,
        agents: ['codex'],
      };

      // h2 nx rules make sense when there's already an h1 in the document
      const nxBlock = getAgentRulesWrapped({
        writeNxCloudRules: true,
        useH1: false,
      });
      const existing = '# My Project\n\nSome content\n\n' + nxBlock;

      tree.write('AGENTS.md', existing);

      await setupAiAgentsGenerator(tree, options);

      const content = tree.read('AGENTS.md')?.toString();
      expect(content).toEqual(existing);
    });

    it('should switch h1 to h2 when user adds their own h1 header', async () => {
      const options: SetupAiAgentsGeneratorSchema = {
        directory: '.',
        writeNxCloudRules: true,
        agents: ['codex'],
      };

      // Simulate: nx block was initially created with h1, then user added their own h1
      const nxBlock = getAgentRulesWrapped({
        writeNxCloudRules: true,
        useH1: true,
      });
      const existing = '# My Project\n\nSome content\n\n' + nxBlock;

      tree.write('AGENTS.md', existing);

      await setupAiAgentsGenerator(tree, options);

      const content = tree.read('AGENTS.md')?.toString();
      // Should have switched the nx block to h2
      const expectedNxBlock = getAgentRulesWrapped({
        writeNxCloudRules: true,
        useH1: false,
      });
      expect(content).toEqual(
        '# My Project\n\nSome content\n\n' + expectedNxBlock
      );
    });

    it('should produce no changes when run twice on a fresh file', async () => {
      const options: SetupAiAgentsGeneratorSchema = {
        directory: '.',
        writeNxCloudRules: true,
        agents: ['codex'],
      };

      await setupAiAgentsGenerator(tree, options);
      const firstContent = tree.read('AGENTS.md')?.toString();

      await setupAiAgentsGenerator(tree, options);
      const secondContent = tree.read('AGENTS.md')?.toString();

      expect(secondContent).toEqual(firstContent);
    });

    it('should produce no changes when run twice on a file with existing h1 header', async () => {
      const options: SetupAiAgentsGeneratorSchema = {
        directory: '.',
        writeNxCloudRules: true,
        agents: ['codex'],
      };

      const existing = '# My Project Rules\n\nSome existing content';
      tree.write('AGENTS.md', existing);

      await setupAiAgentsGenerator(tree, options);
      const firstContent = tree.read('AGENTS.md')?.toString();

      await setupAiAgentsGenerator(tree, options);
      const secondContent = tree.read('AGENTS.md')?.toString();

      expect(secondContent).toEqual(firstContent);
    });

    it('should produce no changes when run twice on a file without h1 header', async () => {
      const options: SetupAiAgentsGeneratorSchema = {
        directory: '.',
        writeNxCloudRules: true,
        agents: ['codex'],
      };

      const existing = 'Some existing content without a header';
      tree.write('AGENTS.md', existing);

      await setupAiAgentsGenerator(tree, options);
      const firstContent = tree.read('AGENTS.md')?.toString();

      await setupAiAgentsGenerator(tree, options);
      const secondContent = tree.read('AGENTS.md')?.toString();

      expect(secondContent).toEqual(firstContent);
    });

    it('should update existing AGENTS.md when outdated nx rules exist', async () => {
      const options: SetupAiAgentsGeneratorSchema = {
        directory: '.',
        writeNxCloudRules: true,
        agents: ['codex'],
      };

      const expected = getAgentRulesWrapped({
        writeNxCloudRules: true,
        useH1: true,
      });
      const existing = expected.replace(
        'nx_workspace',
        'nx_workspace_outdated'
      );

      tree.write('AGENTS.md', existing);

      await setupAiAgentsGenerator(tree, options);
      const content = tree.read('AGENTS.md')?.toString();
      expect(content).toEqual(expected);
    });

    it('should NOT update existing AGENTS.md when they only diverge in whitespace', async () => {
      const options: SetupAiAgentsGeneratorSchema = {
        directory: '.',
        writeNxCloudRules: true,
        agents: ['codex'],
      };

      const expected = getAgentRulesWrapped({
        writeNxCloudRules: true,
        useH1: true,
      });
      const existing = expected.replace('#', '\n#');
      tree.write('AGENTS.md', existing);

      await setupAiAgentsGenerator(tree, options);
      const content = tree.read('AGENTS.md')?.toString();
      expect(content).toEqual(existing);
    });
  });

  describe('agent-specific file generation', () => {
    describe('copilot / cursor / codex', () => {
      it('should generate AGENTS.md when it does not exist', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
        };

        await setupAiAgentsGenerator(tree, options);

        expect(tree.exists('AGENTS.md')).toBe(true);
        const content = tree.read('AGENTS.md')?.toString();
        expect(content).toContain('# General Guidelines for working with Nx');
      });

      it('should NOT overwrite AGENTS.md if it already exists', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
        };

        // Create existing file
        tree.write('AGENTS.md', 'Existing agents content');

        await setupAiAgentsGenerator(tree, options);

        const content = tree.read('AGENTS.md')?.toString();
        // The new implementation appends to existing content
        expect(content).toContain('Existing agents content');
      });
    });
    describe('claude', () => {
      it('should generate CLAUDE.md when it does not exist', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['claude'],
        };

        await setupAiAgentsGenerator(tree, options);

        expect(tree.exists('CLAUDE.md')).toBe(true);
        const content = tree.read('CLAUDE.md')?.toString();
        expect(content).toContain('# General Guidelines for working with Nx');
      });

      it('should NOT overwrite CLAUDE.md if it already exists', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['claude'],
        };

        // Create existing file
        tree.write('CLAUDE.md', 'Existing content');

        await setupAiAgentsGenerator(tree, options);

        const content = tree.read('CLAUDE.md')?.toString();
        // The new implementation appends to existing content
        expect(content).toContain('Existing content');
      });

      it('should NOT generate CLAUDE.md when claude is not in agents array', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['gemini'],
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

      it('should add polygraph tool permissions when writeNxCloudRules is true', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['claude'],
          writeNxCloudRules: true,
        };

        await setupAiAgentsGenerator(tree, options);

        const config = JSON.parse(
          tree.read('.claude/settings.json')?.toString() ?? '{}'
        );
        expect(config.permissions.allow).toEqual([
          'mcp__plugin_nx_nx-mcp__cloud_polygraph_delegate',
          'mcp__plugin_nx_nx-mcp__cloud_child_status',
        ]);
      });

      it('should NOT add polygraph tool permissions when writeNxCloudRules is false', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['claude'],
          writeNxCloudRules: false,
        };

        await setupAiAgentsGenerator(tree, options);

        const config = JSON.parse(
          tree.read('.claude/settings.json')?.toString() ?? '{}'
        );
        expect(config.permissions).toBeUndefined();
      });

      it('should preserve existing permissions.allow entries when adding polygraph tools', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['claude'],
          writeNxCloudRules: true,
        };

        tree.write(
          '.claude/settings.json',
          JSON.stringify({
            permissions: {
              allow: ['some_other_tool'],
            },
          })
        );

        await setupAiAgentsGenerator(tree, options);

        const config = JSON.parse(
          tree.read('.claude/settings.json')?.toString() ?? '{}'
        );
        expect(config.permissions.allow).toEqual([
          'some_other_tool',
          'mcp__plugin_nx_nx-mcp__cloud_polygraph_delegate',
          'mcp__plugin_nx_nx-mcp__cloud_child_status',
        ]);
      });

      it('should preserve existing permissions.deny when adding polygraph tools', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['claude'],
          writeNxCloudRules: true,
        };

        tree.write(
          '.claude/settings.json',
          JSON.stringify({
            permissions: {
              deny: ['dangerous_tool'],
            },
          })
        );

        await setupAiAgentsGenerator(tree, options);

        const config = JSON.parse(
          tree.read('.claude/settings.json')?.toString() ?? '{}'
        );
        expect(config.permissions.deny).toEqual(['dangerous_tool']);
        expect(config.permissions.allow).toEqual([
          'mcp__plugin_nx_nx-mcp__cloud_polygraph_delegate',
          'mcp__plugin_nx_nx-mcp__cloud_child_status',
        ]);
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
        // Should also generate AGENTS.md by default
        expect(tree.exists('AGENTS.md')).toBe(true);
        // Should NOT generate claude files when only gemini is specified
        expect(tree.exists('CLAUDE.md')).toBe(false);
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

      it('should NOT set contextFileName to AGENTS.md when GEMINI.md already exists', async () => {
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

      it('should set contextFileName to AGENTS.md when GEMINI.md does NOT exist', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
        };

        await setupAiAgentsGenerator(tree, options);

        const config = JSON.parse(
          tree.read('.gemini/settings.json')?.toString() ?? '{}'
        );
        // Should set contextFileName to AGENTS.md when GEMINI.md doesn't exist
        expect(config.contextFileName).toBe('AGENTS.md');
        expect(config.mcpServers['nx-mcp']).toEqual({
          type: 'stdio',
          command: 'npx',
          args: ['nx', 'mcp'],
        });
      });

      it('should respect existing contextFileName for rule generation', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['gemini'],
        };

        tree.write('CUSTOM-GEMINI.md', '# Custom Gemini configuration');
        tree.write(
          '.gemini/settings.json',
          JSON.stringify({
            contextFileName: 'CUSTOM-GEMINI.md',
          })
        );

        await setupAiAgentsGenerator(tree, options);

        const configAfter = readJson(tree, '.gemini/settings.json');

        expect(configAfter.contextFileName).toBe('CUSTOM-GEMINI.md');
        const content = tree.read('CUSTOM-GEMINI.md')?.toString();
        expect(content).toContain('Custom Gemini configuration');
        expect(content).toContain('Nx');
      });
    });

    describe('multiple agents', () => {
      it('should generate files for both claude and gemini when both are specified', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
          agents: ['claude', 'gemini'],
        };

        await setupAiAgentsGenerator(tree, options);

        expect(tree.exists('CLAUDE.md')).toBe(true);
        expect(tree.exists('.claude/settings.json')).toBe(true);
        expect(tree.exists('.gemini/settings.json')).toBe(true);
        expect(tree.exists('AGENTS.md')).toBe(true);
        // .mcp.json should NOT be created - Claude uses plugin, Gemini uses .gemini/settings.json
        expect(tree.exists('.mcp.json')).toBe(false);
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
        readModulePackageJsonSpy.mockReturnValue({
          packageJson: { name: 'nx', version: '22.0.0' },
          path: '/fake/path/package.json',
        });

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

    describe('Nx version-specific MCP configuration', () => {
      it('should use "nx mcp" for Nx 22+ (gemini)', async () => {
        readModulePackageJsonSpy.mockReturnValue({
          packageJson: { name: 'nx', version: '22.0.0' },
          path: '/fake/path/package.json',
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
      });

      it('should use "nx-mcp" for Nx < 22 (gemini)', async () => {
        readModulePackageJsonSpy.mockReturnValue({
          packageJson: { name: 'nx', version: '21.0.0' },
          path: '/fake/path/package.json',
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
          args: ['nx-mcp'],
        });
      });

      it('should use "nx mcp" as fallback when version cannot be determined (gemini)', async () => {
        readModulePackageJsonSpy.mockImplementation(() => {
          throw new Error('Module not found');
        });

        // Mock readFileSync to fail only for package.json so it falls back to default version
        // but allow other file reads (needed for generateFiles)
        const originalReadFileSync = fs.readFileSync;
        const readFileSyncSpy = jest
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
        readModulePackageJsonSpy.mockReturnValue({
          packageJson: { name: 'nx', version: '23.1.0' },
          path: '/fake/path/package.json',
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
      });
    });
  });
});
