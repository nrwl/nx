import 'nx/src/internal-testing-utils/mock-project-graph';

import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree } from '@nx/devkit';

import { setupAiAgentsGenerator } from './set-up-ai-agents';
import { SetupAiAgentsGeneratorSchema } from './schema';

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

  describe('file generation', () => {
    it('should generate CLAUDE.md when it does not exist', async () => {
      const options: SetupAiAgentsGeneratorSchema = {
        directory: '.',
      };

      await setupAiAgentsGenerator(tree, options);

      expect(tree.exists('CLAUDE.md')).toBe(true);
      const content = tree.read('CLAUDE.md').toString();
      expect(content).toContain('# General Guidelines for working with Nx');
    });

    it('should NOT generate CLAUDE.md if it already exists', async () => {
      const options: SetupAiAgentsGeneratorSchema = {
        directory: '.',
      };

      // Create existing file
      tree.write('CLAUDE.md', 'Existing content');

      await setupAiAgentsGenerator(tree, options);

      const content = tree.read('CLAUDE.md').toString();
      expect(content.trim()).toBe('Existing content');
    });

    it('should generate GEMINI.md when it does not exist', async () => {
      const options: SetupAiAgentsGeneratorSchema = {
        directory: '.',
      };

      await setupAiAgentsGenerator(tree, options);

      expect(tree.exists('GEMINI.md')).toBe(true);
      const content = tree.read('GEMINI.md').toString();
      expect(content).toContain('# General Guidelines for working with Nx');
    });

    it('should NOT generate GEMINI.md if it already exists', async () => {
      const options: SetupAiAgentsGeneratorSchema = {
        directory: '.',
      };

      // Create existing file
      tree.write('GEMINI.md', 'Existing gemini content');

      await setupAiAgentsGenerator(tree, options);

      const content = tree.read('GEMINI.md').toString();
      expect(content.trim()).toBe('Existing gemini content');
    });
  });

  describe('MCP configuration', () => {
    it('should create .mcp.json with nx-mcp server when file does not exist', async () => {
      const options: SetupAiAgentsGeneratorSchema = {
        directory: '.',
      };

      await setupAiAgentsGenerator(tree, options);

      expect(tree.exists('.mcp.json')).toBe(true);
      const config = JSON.parse(tree.read('.mcp.json').toString());
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

      const config = JSON.parse(tree.read('.mcp.json').toString());
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

      const config = JSON.parse(tree.read('.mcp.json').toString());
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

    it('should create .gemini/settings.json with nx-mcp server when file does not exist', async () => {
      const options: SetupAiAgentsGeneratorSchema = {
        directory: '.',
      };

      await setupAiAgentsGenerator(tree, options);

      expect(tree.exists('.gemini/settings.json')).toBe(true);
      const config = JSON.parse(tree.read('.gemini/settings.json').toString());
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

      const config = JSON.parse(tree.read('.gemini/settings.json').toString());
      expect(config.someConfig).toBe('value');
      expect(config.mcpServers['existing-server']).toBeDefined();
      expect(config.mcpServers['nx-mcp']).toEqual({
        type: 'stdio',
        command: 'npx',
        args: ['nx', 'mcp'],
      });
    });
  });

  describe('options', () => {
    it('should respect writeNxCloudRules option', async () => {
      const options: SetupAiAgentsGeneratorSchema = {
        directory: '.',
        writeNxCloudRules: true,
      };

      await setupAiAgentsGenerator(tree, options);

      const claudeContent = tree.read('CLAUDE.md').toString();
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
      expect(tree.exists('custom-dir/GEMINI.md')).toBe(true);
      expect(tree.exists('custom-dir/.mcp.json')).toBe(true);
      expect(tree.exists('custom-dir/.gemini/settings.json')).toBe(true);
    });
  });
});
