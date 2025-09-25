import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import { Tree } from '../../generators/tree';

import { setupAiAgentsGenerator } from './set-up-ai-agents';
import { SetupAiAgentsGeneratorSchema } from './schema';
import { readJson } from '../../generators/utils/json';
import { getAgentRulesWrapped } from '../constants';

describe('setup-ai-agents generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    // Use local implementation instead of fetching from latest
    process.env.NX_AI_FILES_USE_LOCAL = 'true';
  });

  afterEach(() => {
    delete process.env.NX_AI_FILES_USE_LOCAL;
  });

  it('should respect writeNxCloudRules option', async () => {
    const options: SetupAiAgentsGeneratorSchema = {
      directory: '.',
      writeNxCloudRules: true,
    };

    await setupAiAgentsGenerator(tree, options);

    const claudeContent = tree.read('CLAUDE.md')?.toString();
    // The template should include NX Cloud rules when writeNxCloudRules is true
    expect(claudeContent).toContain('# CI Error Guidelines');
  });

  it('should use specified directory', async () => {
    const options: SetupAiAgentsGeneratorSchema = {
      directory: 'custom-dir',
    };

    await setupAiAgentsGenerator(tree, options);

    expect(tree.exists('custom-dir/CLAUDE.md')).toBe(true);
    expect(tree.exists('custom-dir/AGENTS.md')).toBe(true);
    expect(tree.exists('custom-dir/.mcp.json')).toBe(true);
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
      expect(content).toEqual(existing + '\n\n' + getAgentRulesWrapped(true));
    });

    it('should NOT modify AGENTS.md when up-to-date nx rules exist', async () => {
      const options: SetupAiAgentsGeneratorSchema = {
        directory: '.',
        writeNxCloudRules: true,
        agents: ['codex'],
      };

      const existing = getAgentRulesWrapped(true);

      tree.write('AGENTS.md', existing);

      await setupAiAgentsGenerator(tree, options);

      const content = tree.read('AGENTS.md')?.toString();
      expect(content).toEqual(existing);
    });

    it('should update existing AGENTS.md when outdated nx rules exist', async () => {
      const options: SetupAiAgentsGeneratorSchema = {
        directory: '.',
        writeNxCloudRules: true,
        agents: ['codex'],
      };

      const expected = getAgentRulesWrapped(true);
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

      const expected = getAgentRulesWrapped(true);
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
        expect(tree.exists('.mcp.json')).toBe(false);
      });

      it('should create .mcp.json with nx-mcp server when file does not exist', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
        };

        await setupAiAgentsGenerator(tree, options);

        expect(tree.exists('.mcp.json')).toBe(true);
        const config = JSON.parse(tree.read('.mcp.json')?.toString() ?? '{}');
        expect(config.mcpServers['nx-mcp']).toEqual({
          type: 'stdio',
          command: 'npx',
          args: ['nx', 'mcp'],
        });
      });

      it('should add nx-mcp server to existing .mcp.json without mcpServers', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
        };

        // Create existing config without mcpServers
        tree.write(
          '.mcp.json',
          JSON.stringify({ someOtherConfig: 'value' }, null, 2)
        );

        await setupAiAgentsGenerator(tree, options);

        const config = JSON.parse(tree.read('.mcp.json')?.toString() ?? '{}');
        expect(config.someOtherConfig).toBe('value');
        expect(config.mcpServers['nx-mcp']).toEqual({
          type: 'stdio',
          command: 'npx',
          args: ['nx', 'mcp'],
        });
      });

      it('should add nx-mcp server to existing .mcp.json with mcpServers', async () => {
        const options: SetupAiAgentsGeneratorSchema = {
          directory: '.',
        };

        // Create existing config with mcpServers
        tree.write(
          '.mcp.json',
          JSON.stringify(
            {
              mcpServers: {
                'other-server': {
                  type: 'stdio',
                  command: 'other',
                  args: ['cmd'],
                },
              },
            },
            null,
            2
          )
        );

        await setupAiAgentsGenerator(tree, options);

        const config = JSON.parse(tree.read('.mcp.json')?.toString() ?? '{}');
        expect(config.mcpServers['other-server']).toEqual({
          type: 'stdio',
          command: 'other',
          args: ['cmd'],
        });
        expect(config.mcpServers['nx-mcp']).toEqual({
          type: 'stdio',
          command: 'npx',
          args: ['nx', 'mcp'],
        });
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
        expect(tree.exists('.mcp.json')).toBe(true);
        expect(tree.exists('.gemini/settings.json')).toBe(true);
        expect(tree.exists('AGENTS.md')).toBe(true);
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
  });
});
