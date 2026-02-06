import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { major } from 'semver';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';
import { Tree } from '../../generators/tree';
import { generateFiles } from '../../generators/utils/generate-files';
import { readJson, updateJson, writeJson } from '../../generators/utils/json';
import {
  canInstallNxConsoleForEditor,
  installNxConsoleForEditor,
  isEditorInstalled,
  SupportedEditor,
} from '../../native';
import {
  CLIErrorMessageConfig,
  CLINoteMessageConfig,
} from '../../utils/output';
import {
  installPackageToTmp,
  readModulePackageJson,
} from '../../utils/package-json';
import { ensurePackageHasProvenance } from '../../utils/provenance';
import { workspaceRoot } from '../../utils/workspace-root';
import {
  agentsMdPath,
  claudeMcpJsonPath,
  codexConfigTomlPath,
  geminiMdPath,
  opencodeMcpPath,
} from '../constants';
import { getAiConfigRepoPath } from '../clone-ai-config-repo';
import { Agent, supportedAgents } from '../utils';
import {
  getAgentRulesWrapped,
  getNxMcpTomlConfig,
  nxMcpTomlHeader,
  nxRulesMarkerCommentDescription,
  nxRulesMarkerCommentEnd,
  nxRulesMarkerCommentStart,
  rulesRegex,
} from '../constants';
import {
  NormalizedSetupAiAgentsGeneratorSchema,
  SetupAiAgentsGeneratorSchema,
} from './schema';

export type ModificationResults = {
  messages: CLINoteMessageConfig[];
  errors: CLIErrorMessageConfig[];
};

/**
 * Get the installed Nx version, with fallback to workspace package.json or default version.
 */
function getNxVersion(): string {
  try {
    // Try to read from node_modules first
    const {
      packageJson: { version },
    } = readModulePackageJson('nx');
    return version;
  } catch {
    try {
      // Fallback: try to read from workspace package.json
      const workspacePackageJson = JSON.parse(
        readFileSync(join(workspaceRoot, 'package.json'), 'utf-8')
      );
      // Check devDependencies first, then dependencies
      const nxVersion =
        workspacePackageJson.devDependencies?.nx ||
        workspacePackageJson.dependencies?.nx;
      if (nxVersion) {
        // Remove any semver range characters (^, ~, >=, etc.)
        return nxVersion.replace(/^[\^~>=<]+/, '');
      }
      throw new Error('Nx not found in package.json');
    } catch {
      // If we can't determine the version, default to the newer format
      // This handles cases where nx might not be installed or is globally installed
      return '22.0.0';
    }
  }
}

export async function setupAiAgentsGenerator(
  tree: Tree,
  options: SetupAiAgentsGeneratorSchema,
  inner = false
): Promise<(check?: boolean) => Promise<ModificationResults>> {
  const normalizedOptions: NormalizedSetupAiAgentsGeneratorSchema =
    normalizeOptions(options);

  // Use environment variable to force local execution
  if (process.env.NX_AI_FILES_USE_LOCAL === 'true' || inner) {
    return await setupAiAgentsGeneratorImpl(tree, normalizedOptions);
  }

  try {
    await ensurePackageHasProvenance('nx', normalizedOptions.packageVersion);

    const { tempDir, cleanup } = installPackageToTmp(
      'nx',
      normalizedOptions.packageVersion
    );

    let modulePath = join(
      tempDir,
      'node_modules',
      'nx',
      'src/ai/set-up-ai-agents/set-up-ai-agents.js'
    );

    const module = await import(modulePath);
    const setupAiAgentsGeneratorResult = await module.setupAiAgentsGenerator(
      tree,
      normalizedOptions,
      true
    );
    cleanup();
    return setupAiAgentsGeneratorResult;
  } catch (error) {
    return await setupAiAgentsGeneratorImpl(tree, normalizedOptions);
  }
}

function normalizeOptions(
  options: SetupAiAgentsGeneratorSchema
): NormalizedSetupAiAgentsGeneratorSchema {
  return {
    directory: options.directory,
    writeNxCloudRules: options.writeNxCloudRules ?? false,
    packageVersion: options.packageVersion ?? 'latest',
    agents: options.agents ?? [...supportedAgents],
  };
}

export async function setupAiAgentsGeneratorImpl(
  tree: Tree,
  options: NormalizedSetupAiAgentsGeneratorSchema
): Promise<() => Promise<ModificationResults>> {
  const hasAgent = (agent: Agent) => options.agents.includes(agent);
  const nxVersion = getNxVersion();

  const agentsMd = agentsMdPath(options.directory);

  // write AGENTS.md for most agents
  if (
    hasAgent('cursor') ||
    hasAgent('copilot') ||
    hasAgent('codex') ||
    hasAgent('opencode')
  ) {
    writeAgentRules(tree, agentsMd, options.writeNxCloudRules);
  }

  if (hasAgent('claude')) {
    const claudePath = join(options.directory, 'CLAUDE.md');
    writeAgentRules(tree, claudePath, options.writeNxCloudRules);

    // Configure Claude plugin via marketplace (plugin includes MCP server)
    const claudeSettingsPath = join(
      options.directory,
      '.claude',
      'settings.json'
    );
    if (!tree.exists(claudeSettingsPath)) {
      writeJson(tree, claudeSettingsPath, {});
    }
    updateJson(tree, claudeSettingsPath, (json) => ({
      ...json,
      extraKnownMarketplaces: {
        ...json.extraKnownMarketplaces,
        'nx-claude-plugins': {
          source: {
            source: 'github',
            repo: 'nrwl/nx-ai-agents-config',
          },
        },
      },
      enabledPlugins: {
        ...json.enabledPlugins,
        'nx@nx-claude-plugins': true,
      },
    }));

    // Clean up .mcp.json (nx-mcp now handled by plugin)
    const mcpJsonPath = claudeMcpJsonPath(options.directory);
    if (tree.exists(mcpJsonPath)) {
      try {
        const mcpJsonContents = readJson(tree, mcpJsonPath);
        if (mcpJsonContents?.mcpServers?.['nx-mcp']) {
          const serverKeys = Object.keys(mcpJsonContents.mcpServers || {});
          if (serverKeys.length === 1 && serverKeys[0] === 'nx-mcp') {
            // nx-mcp is the only server, delete the file
            tree.delete(mcpJsonPath);
          } else {
            // Other servers exist, just remove nx-mcp entry
            delete mcpJsonContents.mcpServers['nx-mcp'];
            writeJson(tree, mcpJsonPath, mcpJsonContents);
          }
        }
      } catch {
        // Ignore errors reading .mcp.json
      }
    }
  }

  if (hasAgent('opencode')) {
    const opencodeMcpJsonPath = opencodeMcpPath(options.directory);
    if (!tree.exists(opencodeMcpJsonPath)) {
      writeJson(tree, opencodeMcpJsonPath, {});
    }
    updateJson(tree, opencodeMcpJsonPath, (json) =>
      opencodeMcpConfigUpdater(json, nxVersion)
    );
  }

  if (hasAgent('gemini')) {
    const geminiSettingsPath = join(
      options.directory,
      '.gemini',
      'settings.json'
    );
    if (!tree.exists(geminiSettingsPath)) {
      writeJson(tree, geminiSettingsPath, {});
    }
    updateJson(tree, geminiSettingsPath, (json) =>
      mcpConfigUpdater(json, nxVersion)
    );

    const contextFileName: string | undefined = readJson(
      tree,
      geminiSettingsPath
    ).contextFileName;

    const geminiMd = geminiMdPath(options.directory);

    // Only set contextFileName to AGENTS.md if GEMINI.md doesn't exist already to preserve existing setups
    if (!contextFileName && !tree.exists(geminiMd)) {
      writeAgentRules(tree, agentsMd, options.writeNxCloudRules);
      updateJson(tree, geminiSettingsPath, (json) => ({
        ...json,
        contextFileName: 'AGENTS.md',
      }));
    } else {
      writeAgentRules(
        tree,
        contextFileName ?? geminiMd,
        options.writeNxCloudRules
      );
    }
  }

  // Copy extensibility artifacts (commands, skills, subagents) for non-Claude agents
  if (
    hasAgent('opencode') ||
    hasAgent('copilot') ||
    hasAgent('cursor') ||
    hasAgent('codex') ||
    hasAgent('gemini')
  ) {
    const repoPath = getAiConfigRepoPath();

    const agentDirs: { agent: Agent; src: string; dest: string }[] = [
      { agent: 'opencode', src: 'generated/.opencode', dest: '.opencode' },
      { agent: 'copilot', src: 'generated/.github', dest: '.github' },
      { agent: 'cursor', src: 'generated/.cursor', dest: '.cursor' },
      { agent: 'codex', src: 'generated/.codex', dest: '.codex' },
      { agent: 'gemini', src: 'generated/.gemini', dest: '.gemini' },
    ];

    for (const { agent, src, dest } of agentDirs) {
      if (hasAgent(agent)) {
        const srcPath = join(repoPath, src);
        if (existsSync(srcPath)) {
          generateFiles(tree, srcPath, join(options.directory, dest), {});
        }
      }
    }
  }

  await formatChangedFilesWithPrettierIfAvailable(tree);

  // we use the check variable to determine if we should actually make changes or just report what would be changed
  return async (check: boolean = false) => {
    const messages: CLINoteMessageConfig[] = [];
    const errors: CLIErrorMessageConfig[] = [];
    if (hasAgent('codex')) {
      if (existsSync(codexConfigTomlPath)) {
        const tomlContents = readFileSync(codexConfigTomlPath, 'utf-8');
        if (!tomlContents.includes(nxMcpTomlHeader)) {
          if (!check) {
            appendFileSync(
              codexConfigTomlPath,
              `\n${getNxMcpTomlConfig(nxVersion)}`
            );
          }
          messages.push({
            title: `Updated ${codexConfigTomlPath} with nx-mcp server`,
          });
        }
      } else {
        if (!check) {
          mkdirSync(join(homedir(), '.codex'), { recursive: true });
          writeFileSync(codexConfigTomlPath, getNxMcpTomlConfig(nxVersion));
        }
        messages.push({
          title: `Created ${codexConfigTomlPath} with nx-mcp server`,
        });
      }
    }

    if (hasAgent('copilot')) {
      try {
        if (
          isEditorInstalled(SupportedEditor.VSCode) &&
          canInstallNxConsoleForEditor(SupportedEditor.VSCode)
        ) {
          if (!check) {
            installNxConsoleForEditor(SupportedEditor.VSCode);
          }
          messages.push({
            title: `Installed Nx Console for VSCode`,
          });
        }
      } catch (e) {
        errors.push({
          title: `Failed to install Nx Console for VSCode. Please install it manually.`,
          bodyLines: [(e as Error).message],
        });
      }
      try {
        if (
          isEditorInstalled(SupportedEditor.VSCodeInsiders) &&
          canInstallNxConsoleForEditor(SupportedEditor.VSCodeInsiders)
        ) {
          if (!check) {
            installNxConsoleForEditor(SupportedEditor.VSCodeInsiders);
          }
          messages.push({
            title: `Installed Nx Console for VSCode Insiders`,
          });
        }
      } catch (e) {
        errors.push({
          title: `Failed to install Nx Console for VSCode Insiders. Please install it manually.`,
          bodyLines: [(e as Error).message],
        });
      }
    }
    if (hasAgent('cursor')) {
      try {
        if (
          isEditorInstalled(SupportedEditor.Cursor) &&
          canInstallNxConsoleForEditor(SupportedEditor.Cursor)
        ) {
          if (!check) {
            installNxConsoleForEditor(SupportedEditor.Cursor);
          }
          messages.push({
            title: `Installed Nx Console for Cursor`,
          });
        }
      } catch (e) {
        errors.push({
          title: `Failed to install Nx Console for Cursor. Please install it manually.`,
          bodyLines: [(e as Error).message],
        });
      }
    }
    return {
      messages,
      errors,
    };
  };
}

function writeAgentRules(tree: Tree, path: string, writeNxCloudRules: boolean) {
  const expectedRules = getAgentRulesWrapped(writeNxCloudRules);

  if (!tree.exists(path)) {
    tree.write(path, expectedRules);
    return;
  }

  const existing = tree.read(path, 'utf-8');

  const regex = rulesRegex;
  const existingNxConfiguration = existing.match(regex);

  if (existingNxConfiguration) {
    const contentOnly = (str: string) =>
      str
        .replace(nxRulesMarkerCommentStart, '')
        .replace(nxRulesMarkerCommentEnd, '')
        .replace(nxRulesMarkerCommentDescription, '')
        .replace(/\s/g, '');

    // we don't want to make updates on whitespace-only changes
    if (
      contentOnly(existingNxConfiguration[0]) === contentOnly(expectedRules)
    ) {
      return;
    }
    // otherwise replace the existing configuration
    const updatedContent = existing.replace(regex, expectedRules);
    tree.write(path, updatedContent);
  } else {
    tree.write(path, existing + '\n\n' + expectedRules);
  }
}

function mcpConfigUpdater(existing: any, nxVersion: string): any {
  const majorVersion = major(nxVersion);
  const mcpArgs = majorVersion >= 22 ? ['nx', 'mcp'] : ['nx-mcp'];

  if (existing.mcpServers) {
    existing.mcpServers['nx-mcp'] = {
      type: 'stdio',
      command: 'npx',
      args: mcpArgs,
    };
  } else {
    existing.mcpServers = {
      'nx-mcp': {
        type: 'stdio',
        command: 'npx',
        args: mcpArgs,
      },
    };
  }
  return existing;
}

function opencodeMcpConfigUpdater(existing: any, nxVersion: string): any {
  const majorVersion = major(nxVersion);
  const mcpCommand =
    majorVersion >= 22 ? ['npx', 'nx', 'mcp'] : ['npx', 'nx-mcp'];

  if (existing.mcp) {
    existing.mcp['nx-mcp'] = {
      type: 'local',
      command: mcpCommand,
      enabled: true,
    };
  } else {
    existing.mcp = {
      'nx-mcp': {
        type: 'local',
        command: mcpCommand,
        enabled: true,
      },
    };
  }
  return existing;
}

export default setupAiAgentsGenerator;
