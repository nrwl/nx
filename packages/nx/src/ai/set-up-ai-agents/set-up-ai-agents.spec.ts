import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import { Tree } from '../../generators/tree';

import { setupAiAgentsGenerator } from './set-up-ai-agents';
import { SetupAiAgentsGeneratorSchema } from './schema';
import { readJson } from '../../generators/utils/json';
import { getAgentRulesWrapped } from '../constants';
import * as packageJsonUtils from '../../utils/package-json';
import * as cloneAiConfigRepo from '../clone-ai-config-repo';
import * as fs from 'fs';
import { join } from 'path';
import { mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';

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

    describe('extensibility artifacts', () => {
      let tmpRepoPath: string;
      let getAiConfigRepoPathSpy: jest.SpyInstance;

      beforeEach(() => {
        tmpRepoPath = mkdtempSync(join(tmpdir(), 'nx-ai-config-test-'));

        // Create per-agent generated directories with test files
        for (const dir of [
          '.cursor/agents',
          '.cursor/commands',
          '.opencode/agents',
          '.opencode/commands',
          '.github/skills/nx-workspace',
          '.codex/skills/nx-workspace',
          '.gemini/skills/nx-workspace',
          '.agents/skills/nx-workspace',
        ]) {
          mkdirSync(join(tmpRepoPath, 'generated', dir), { recursive: true });
        }

        // Write test skill files into per-agent dirs
        for (const agentDir of ['.github', '.codex', '.gemini']) {
          writeFileSync(
            join(
              tmpRepoPath,
              'generated',
              agentDir,
              'skills/nx-workspace/SKILL.md'
            ),
            `# ${agentDir} skill`
          );
        }

        // Write test files into per-agent agent/command dirs
        writeFileSync(
          join(tmpRepoPath, 'generated', '.cursor/agents/test-agent.md'),
          '# Cursor agent'
        );
        writeFileSync(
          join(tmpRepoPath, 'generated', '.cursor/commands/test-command.md'),
          '# Cursor command'
        );
        writeFileSync(
          join(tmpRepoPath, 'generated', '.opencode/agents/test-agent.md'),
          '# OpenCode agent'
        );
        writeFileSync(
          join(tmpRepoPath, 'generated', '.opencode/commands/test-command.md'),
          '# OpenCode command'
        );

        // Write shared .agents/skills/ content
        writeFileSync(
          join(
            tmpRepoPath,
            'generated',
            '.agents/skills/nx-workspace/SKILL.md'
          ),
          '# Shared skill'
        );

        getAiConfigRepoPathSpy = jest
          .spyOn(cloneAiConfigRepo, 'getAiConfigRepoPath')
          .mockReturnValue(tmpRepoPath);
      });

      afterEach(() => {
        getAiConfigRepoPathSpy.mockRestore();
        rmSync(tmpRepoPath, { recursive: true, force: true });
      });

      it('should copy .agents/skills/ when cursor is selected', async () => {
        await setupAiAgentsGenerator(tree, {
          directory: '.',
          agents: ['cursor'],
        });

        // Per-agent artifacts copied (agents + commands only, no skills)
        expect(tree.exists('.cursor/agents/test-agent.md')).toBe(true);
        expect(tree.exists('.cursor/commands/test-command.md')).toBe(true);
        expect(tree.exists('.cursor/skills')).toBe(false);

        // Shared .agents/skills/ copied instead
        expect(tree.exists('.agents/skills/nx-workspace/SKILL.md')).toBe(true);
        expect(
          tree.read('.agents/skills/nx-workspace/SKILL.md')?.toString()
        ).toContain('Shared skill');
      });

      it('should copy .agents/skills/ when opencode is selected', async () => {
        await setupAiAgentsGenerator(tree, {
          directory: '.',
          agents: ['opencode'],
        });

        // Per-agent artifacts copied (agents + commands only, no skills)
        expect(tree.exists('.opencode/agents/test-agent.md')).toBe(true);
        expect(tree.exists('.opencode/commands/test-command.md')).toBe(true);
        expect(tree.exists('.opencode/skills')).toBe(false);

        // Shared .agents/skills/ copied instead
        expect(tree.exists('.agents/skills/nx-workspace/SKILL.md')).toBe(true);
      });

      it('should NOT copy .agents/skills/ when only claude is selected', async () => {
        await setupAiAgentsGenerator(tree, {
          directory: '.',
          agents: ['claude'],
        });

        expect(tree.exists('.agents/skills/nx-workspace/SKILL.md')).toBe(false);
      });

      it('should NOT copy .agents/skills/ when only copilot is selected', async () => {
        await setupAiAgentsGenerator(tree, {
          directory: '.',
          agents: ['copilot'],
        });

        // copilot gets its own per-agent skills
        expect(tree.exists('.github/skills/nx-workspace/SKILL.md')).toBe(true);

        // but NOT shared .agents/skills/
        expect(tree.exists('.agents/skills/nx-workspace/SKILL.md')).toBe(false);
      });

      it('should NOT copy .agents/skills/ when only gemini is selected', async () => {
        await setupAiAgentsGenerator(tree, {
          directory: '.',
          agents: ['gemini'],
        });

        expect(tree.exists('.gemini/skills/nx-workspace/SKILL.md')).toBe(true);
        expect(tree.exists('.agents/skills/nx-workspace/SKILL.md')).toBe(false);
      });

      it('should NOT copy .agents/skills/ when only codex is selected', async () => {
        await setupAiAgentsGenerator(tree, {
          directory: '.',
          agents: ['codex'],
        });

        expect(tree.exists('.codex/skills/nx-workspace/SKILL.md')).toBe(true);
        expect(tree.exists('.agents/skills/nx-workspace/SKILL.md')).toBe(false);
      });

      it('should copy .agents/skills/ when cursor is among multiple agents', async () => {
        await setupAiAgentsGenerator(tree, {
          directory: '.',
          agents: ['copilot', 'cursor', 'codex'],
        });

        // Each agent gets its own per-agent artifacts
        expect(tree.exists('.github/skills/nx-workspace/SKILL.md')).toBe(true);
        expect(tree.exists('.cursor/agents/test-agent.md')).toBe(true);
        expect(tree.exists('.codex/skills/nx-workspace/SKILL.md')).toBe(true);

        // Shared .agents/skills/ also copied because cursor is selected
        expect(tree.exists('.agents/skills/nx-workspace/SKILL.md')).toBe(true);
      });

      it('should respect custom directory for .agents/skills/', async () => {
        await setupAiAgentsGenerator(tree, {
          directory: 'custom-dir',
          agents: ['cursor'],
        });

        expect(
          tree.exists('custom-dir/.agents/skills/nx-workspace/SKILL.md')
        ).toBe(true);
        expect(tree.exists('custom-dir/.cursor/agents/test-agent.md')).toBe(
          true
        );
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
