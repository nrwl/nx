import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { major } from 'semver';
import TOML from '@ltd/j-toml';
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
  geminiMdPath,
  getAgentRulesWrapped,
  getNxMcpTomlConfig,
  nxMcpTomlHeader,
  nxRulesMarkerCommentDescription,
  nxRulesMarkerCommentEnd,
  nxRulesMarkerCommentStart,
  opencodeMcpPath,
  rulesRegex,
} from '../constants';
import { getAiConfigRepoPath } from '../clone-ai-config-repo';
import { Agent, supportedAgents } from '../utils';
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
            ...json.extraKnownMarketplaces?.['nx-claude-plugins']?.source,
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

  // Get the ai-config repo path once for all non-Claude agents that need it
  const needsAiConfigRepo =
    hasAgent('codex') ||
    hasAgent('opencode') ||
    hasAgent('copilot') ||
    hasAgent('cursor') ||
    hasAgent('gemini');
  let aiConfigRepoPath: string | undefined;
  if (needsAiConfigRepo) {
    try {
      aiConfigRepoPath = getAiConfigRepoPath();
    } catch {
      // Network/clone failure — individual consumers handle fallback
    }
  }

  if (hasAgent('codex')) {
    const codexTomlPath = join(options.directory, '.codex', 'config.toml');
    writeCodexConfig(tree, codexTomlPath, nxVersion, aiConfigRepoPath);
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
  if (aiConfigRepoPath) {
    const repoPath = aiConfigRepoPath;

    const agentDirs: { agent: Agent; src: string; dest: string }[] = [
      { agent: 'opencode', src: 'generated/.opencode', dest: '.opencode' },
      { agent: 'copilot', src: 'generated/.github', dest: '.github' },
      { agent: 'cursor', src: 'generated/.cursor', dest: '.cursor' },
      { agent: 'codex', src: 'generated/.agents', dest: '.agents' },
      {
        agent: 'codex',
        src: 'generated/.codex/agents',
        dest: '.codex/agents',
      },
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
    if (hasAgent('copilot')) {
      try {
        if (
          (await isEditorInstalled(SupportedEditor.VSCode)) &&
          (await canInstallNxConsoleForEditor(SupportedEditor.VSCode))
        ) {
          if (!check) {
            await installNxConsoleForEditor(SupportedEditor.VSCode);
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
          (await isEditorInstalled(SupportedEditor.VSCodeInsiders)) &&
          (await canInstallNxConsoleForEditor(SupportedEditor.VSCodeInsiders))
        ) {
          if (!check) {
            await installNxConsoleForEditor(SupportedEditor.VSCodeInsiders);
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
          (await isEditorInstalled(SupportedEditor.Cursor)) &&
          (await canInstallNxConsoleForEditor(SupportedEditor.Cursor))
        ) {
          if (!check) {
            await installNxConsoleForEditor(SupportedEditor.Cursor);
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
  if (!tree.exists(path)) {
    // File doesn't exist - create with h1 header (standalone content)
    const expectedRules = getAgentRulesWrapped({
      writeNxCloudRules,
      useH1: true,
    });
    tree.write(path, expectedRules);
    return;
  }

  const existing = tree.read(path, 'utf-8');

  const regex = rulesRegex;
  const existingNxConfiguration = existing.match(regex);

  if (existingNxConfiguration) {
    // Check the rest of the file (outside nx block) for an h1 header
    // to ensure only one h1 exists in the document
    const contentWithoutNxBlock = existing.replace(regex, '');
    const hasExternalH1 = /^# /m.test(contentWithoutNxBlock);
    const expectedRules = getAgentRulesWrapped({
      writeNxCloudRules,
      useH1: !hasExternalH1,
    });
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
    // Appending to existing content - use h2 only if the file already has an h1 header
    // This prevents unnecessary changes when users add content without their own h1
    const hasExistingH1 = /^# /m.test(existing);
    const expectedRules = getAgentRulesWrapped({
      writeNxCloudRules,
      useH1: !hasExistingH1,
    });
    tree.write(path, existing + '\n\n' + expectedRules);
  }
}

/**
 * Write or merge the Codex config.toml.
 *
 * Reads the generated config.toml from the nx-ai-agents-config repo (which
 * contains MCP servers, agent definitions, and feature flags) and deep-merges
 * it into the user's existing config.toml using proper TOML parsing.
 *
 * Merge rules:
 * - [mcp_servers."nx-mcp"] — upsert with version-adjusted args, preserving extra user args
 * - [features] multi_agent — set to true unless user has explicitly set it to false
 * - [agents.*] — upsert each agent definition
 * - All other user config is preserved untouched
 *
 * Falls back to a minimal hardcoded MCP config if the generated file is unavailable.
 */
function writeCodexConfig(
  tree: Tree,
  codexTomlPath: string,
  nxVersion: string,
  aiConfigRepoPath?: string
): void {
  let generated: Record<string, any> | null = null;

  if (aiConfigRepoPath) {
    const generatedConfigPath = join(
      aiConfigRepoPath,
      'generated',
      '.codex',
      'config.toml'
    );
    if (existsSync(generatedConfigPath)) {
      const generatedConfig = readFileSync(generatedConfigPath, 'utf-8');
      generated = TOML.parse(generatedConfig) as Record<string, any>;
    }
  }

  if (!generated) {
    // Fallback: use hardcoded MCP-only config (no agents/features)
    const tomlConfig = getNxMcpTomlConfig(nxVersion);
    if (!tree.exists(codexTomlPath)) {
      tree.write(codexTomlPath, tomlConfig);
    } else {
      const existing = tree.read(codexTomlPath, 'utf-8');
      if (!existing.includes(nxMcpTomlHeader)) {
        tree.write(codexTomlPath, existing + '\n' + tomlConfig);
      }
    }
    return;
  }

  // Parse existing config (or start empty)
  let config: Record<string, any> = {};
  if (tree.exists(codexTomlPath)) {
    try {
      config = TOML.parse(tree.read(codexTomlPath, 'utf-8')) as Record<
        string,
        any
      >;
    } catch {
      // If existing file can't be parsed, start fresh
      config = {};
    }
  }

  // ── Merge MCP servers ──
  const majorVersion = major(nxVersion);
  const mcpArgs: string[] = majorVersion >= 22 ? ['nx', 'mcp'] : ['nx-mcp'];

  // Preserve extra user args from existing config
  const existingArgs: string[] =
    (config as any).mcp_servers?.['nx-mcp']?.args ?? [];
  const extraArgs = stripKnownMcpBaseArgs(existingArgs);
  mcpArgs.push(...extraArgs);

  config.mcp_servers ??= {};
  (config as any).mcp_servers['nx-mcp'] = {
    command: 'npx',
    args: mcpArgs,
  };

  // ── Merge features ──
  // Only set multi_agent = true if user hasn't explicitly set it to false
  const userSetMultiAgentFalse =
    (config as any).features?.multi_agent === false;
  if (!userSetMultiAgentFalse && generated.features) {
    config.features ??= {};
    Object.assign(config.features, generated.features);
  }

  // ── Merge agents ──
  if (generated.agents) {
    config.agents ??= {};
    for (const [name, def] of Object.entries(generated.agents)) {
      (config as any).agents[name] = def;
    }
  }

  // ── Serialize and write ──
  const tomlString = TOML.stringify(config as any, {
    newlineAround: 'section',
  });
  tree.write(
    codexTomlPath,
    Array.isArray(tomlString) ? tomlString.join('\n') : tomlString
  );
}

/**
 * Strip known MCP base command args (["nx", "mcp"] or ["nx-mcp"]) from an
 * args array, returning only the extra user-added args.
 */
function stripKnownMcpBaseArgs(args: string[]): string[] {
  const knownBasePatterns = [['nx', 'mcp'], ['nx-mcp']];

  for (const pattern of knownBasePatterns) {
    if (args.length < pattern.length) continue;
    const matches = pattern.every((baseArg, i) => {
      if (baseArg === 'nx-mcp') {
        return args[i] === 'nx-mcp' || args[i].startsWith('nx-mcp@');
      }
      return args[i] === baseArg;
    });
    if (matches) {
      return args.slice(pattern.length);
    }
  }

  return [];
}

/**
 * Extract user-added extra args/flags from an existing MCP config args array
 * by stripping the known base command prefix.
 *
 * Known base patterns (matched in order, first wins):
 *   ['nx', 'mcp']  or  ['nx-mcp'] (possibly with @version suffix like nx-mcp@latest)
 *   For opencode the caller prepends 'npx' to these patterns.
 */
function getExtraMcpArgs(
  existingArgs: string[] | undefined,
  knownBasePatterns: string[][]
): string[] {
  if (!Array.isArray(existingArgs) || existingArgs.length === 0) return [];

  for (const pattern of knownBasePatterns) {
    if (existingArgs.length < pattern.length) continue;

    const matches = pattern.every((baseArg, i) => {
      if (baseArg === 'nx-mcp') {
        // Also match versioned variants like nx-mcp@latest
        return (
          existingArgs[i] === 'nx-mcp' || existingArgs[i].startsWith('nx-mcp@')
        );
      }
      return existingArgs[i] === baseArg;
    });

    if (matches) {
      return existingArgs.slice(pattern.length);
    }
  }

  return [];
}

function mcpConfigUpdater(existing: any, nxVersion: string): any {
  const majorVersion = major(nxVersion);
  const mcpArgs = majorVersion >= 22 ? ['nx', 'mcp'] : ['nx-mcp'];

  // Preserve any extra args (e.g. --experimental-polygraph, --transport http) from existing config
  const extraArgs = getExtraMcpArgs(existing.mcpServers?.['nx-mcp']?.args, [
    ['nx', 'mcp'],
    ['nx-mcp'],
  ]);
  mcpArgs.push(...extraArgs);

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

  // Preserve any extra args (e.g. --experimental-polygraph, --transport http) from existing config
  const extraArgs = getExtraMcpArgs(existing.mcp?.['nx-mcp']?.command, [
    ['npx', 'nx', 'mcp'],
    ['npx', 'nx-mcp'],
  ]);
  mcpCommand.push(...extraArgs);

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
