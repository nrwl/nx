import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { major } from 'semver';
import { formatChangedFiles } from '../../generators/internal-utils/format-changed-files';
import { Tree } from '../../generators/tree';
import { generateFiles } from '../../generators/utils/generate-files';
import { readJson, updateJson, writeJson } from '../../generators/utils/json';
import { readNxJson } from '../../generators/utils/nx-json';
import { isAnalyticsEnabled } from '../../utils/analytics-enabled';
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
import { installPackageToTmp } from '../../utils/package-json';
import { detectPackageManager } from '../../utils/package-manager';
import { addEntryToGitIgnore } from '../../utils/ignore';
import { ensurePackageHasProvenance } from '../../utils/provenance';
import { workspaceRoot } from '../../utils/workspace-root';
import { getInstalledNxVersion } from '../../utils/installed-nx-version';
import {
  analyticsDomain,
  NX_ALLOWLIST_ROOTS,
  claudeMcpJsonPath,
  claudePluginId,
  claudePluginPackage,
  codexConfigTomlPath,
} from '../constants';
import { getAiConfigRepoPath } from '../clone-ai-config-repo';
import { Agent, agentDisplayMap, supportedAgents } from '../utils';
import {
  getLatestAgentPluginVersion,
  pickAgentPluginVersion,
} from './agent-plugin-version';
import {
  hasGeminiNxMcp,
  readCursorPluginVersion,
  readOpencodePluginVersion,
  writeCodexPlugin,
  writeCursorPlugin,
  writeOpencodePlugin,
} from './agent-plugin-config';
import {
  codexPluginInstallCommand,
  installCodexPlugin,
  isCodexAvailable,
  isCodexPluginInstalled,
} from './codex-plugin';
import {
  legacyAgentFolders,
  removeLegacyAgentFiles,
  removeNxRulesBlocks,
} from './legacy-agent-config';
import {
  NormalizedSetupAiAgentsGeneratorSchema,
  SetupAiAgentsGeneratorSchema,
} from './schema';
import { handleImport } from '../../utils/handle-import';

export type ModificationResults = {
  messages: CLINoteMessageConfig[];
  errors: CLIErrorMessageConfig[];
};

/**
 * Best-effort fallback when `getInstalledNxVersion()` can't find an
 * installed nx — read the version declared in the workspace's
 * `package.json` (devDependencies/dependencies), stripping any semver
 * range prefix, and finally a sane default.
 */
function getDeclaredNxVersionOrDefault(): string {
  try {
    const workspacePackageJson = JSON.parse(
      readFileSync(join(workspaceRoot, 'package.json'), 'utf-8')
    );
    const declared =
      workspacePackageJson.devDependencies?.nx ||
      workspacePackageJson.dependencies?.nx;
    if (declared) {
      return declared.replace(/^[\^~>=<]+/, '');
    }
  } catch {
    // fall through to default
  }
  return '22.0.0';
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
      normalizedOptions.packageVersion,
      detectPackageManager(tree.root)
    );

    let modulePath = join(
      tempDir,
      'node_modules',
      'nx',
      'src/ai/set-up-ai-agents/set-up-ai-agents.js'
    );

    const module = await handleImport(modulePath);
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
): Promise<(check?: boolean) => Promise<ModificationResults>> {
  const hasAgent = (agent: Agent) => options.agents.includes(agent);
  const nxVersion = getInstalledNxVersion() ?? getDeclaredNxVersionOrDefault();
  const analyticsEnabled = isAnalyticsEnabled(readNxJson(tree));
  let addedAnalyticsDomain = false;
  // Problems that keep an agent from being configured. They are reported, but
  // unlike messages they don't mark the agent as outdated.
  const setupErrors: CLIErrorMessageConfig[] = [];
  const keptLegacyFiles: string[] = [];

  // The Nx guidelines ship with the agent plugins now, so the blocks older
  // versions wrote into AGENTS.md, CLAUDE.md and GEMINI.md are removed.
  removeNxRulesBlocks(tree, options.directory);

  const latestPluginVersion =
    hasAgent('cursor') || hasAgent('opencode') || hasAgent('codex')
      ? await getLatestAgentPluginVersion()
      : null;
  const pluginVersionUnavailable = (agent: Agent): CLIErrorMessageConfig => ({
    title: `Could not configure the Nx plugin for ${agentDisplayMap[agent]}`,
    bodyLines: [
      `The latest ${claudePluginPackage} version could not be resolved from the npm registry.`,
      'Check your network or registry configuration and run "nx configure-ai-agents" again.',
    ],
  });
  const removeLegacyFiles = (folders: readonly string[]) => {
    const { kept } = removeLegacyAgentFiles(tree, options.directory, folders);
    keptLegacyFiles.push(...kept);
  };

  if (hasAgent('claude')) {
    // Configure Claude plugin via marketplace (plugin includes MCP server)
    const claudeSettingsPath = join(
      options.directory,
      '.claude',
      'settings.json'
    );
    if (!tree.exists(claudeSettingsPath)) {
      writeJson(tree, claudeSettingsPath, {});
    }
    const allowedDomains: string[] | undefined = readJson(
      tree,
      claudeSettingsPath
    ).sandbox?.network?.allowedDomains;
    addedAnalyticsDomain =
      analyticsEnabled && !allowedDomains?.includes(analyticsDomain);
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
        [claudePluginId]: true,
      },
      // Allow Nx unix socket usage (daemon, plugin workers, forked processes)
      // through Claude Code's sandbox, and analytics requests when the
      // workspace has them on. Nx also copies its native binary into a cache
      // under the same fixed tmp root before loading it, so the read/write
      // grants cover that too. The root is a fixed /tmp path on macOS and
      // Linux, so these entries are machine-independent and safe to commit.
      sandbox: {
        ...json.sandbox,
        filesystem: {
          ...json.sandbox?.filesystem,
          allowRead: withEntries(
            json.sandbox?.filesystem?.allowRead,
            ...NX_ALLOWLIST_ROOTS
          ),
          // Covers the whole tmp root, not just the socket dir: the native
          // binary cache lives under it too, and without the cache a running
          // daemon keeps an open handle on the binding inside node_modules,
          // which blocks reinstalling or rebuilding dependencies. What keeps
          // users apart is not this allowlist but the 0700 per-uid directories
          // Nx verifies on every use (see ensureOwnedPrivateDir).
          allowWrite: withEntries(
            json.sandbox?.filesystem?.allowWrite,
            ...NX_ALLOWLIST_ROOTS
          ),
        },
        network: {
          ...json.sandbox?.network,
          // Egress follows the workspace's analytics opt-in (#36663). The
          // socket grant does not: Nx needs its sockets either way.
          ...(analyticsEnabled
            ? {
                allowedDomains: withEntries(
                  json.sandbox?.network?.allowedDomains,
                  analyticsDomain
                ),
              }
            : {}),
          // Covers binding as well as connecting, so a fresh daemon, a plugin
          // worker and a forked task can each create their own socket under
          // these roots. Deliberately scoped rather than `allowAllUnixSockets`,
          // which grants connect access to every socket on the machine —
          // including the Docker and SSH-agent sockets — and grants nothing
          // extra for creating Nx's own.
          allowUnixSockets: withEntries(
            json.sandbox?.network?.allowUnixSockets,
            ...NX_ALLOWLIST_ROOTS
          ),
        },
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

  let cursorConfigured = false;
  if (hasAgent('cursor')) {
    const version = pickAgentPluginVersion(
      latestPluginVersion,
      readCursorPluginVersion(tree, options.directory)
    );
    if (version) {
      writeCursorPlugin(tree, options.directory, version);
      removeLegacyFiles(legacyAgentFolders.cursor);
      cursorConfigured = true;
    } else {
      setupErrors.push(pluginVersionUnavailable('cursor'));
    }
  }

  let codexConfigured = false;
  if (hasAgent('codex')) {
    // Copied subagent files go first so their config entries can go with them.
    removeLegacyFiles(legacyAgentFolders.codex);
    if (writeCodexPlugin(tree, options.directory)) {
      codexConfigured = true;
    } else {
      setupErrors.push({
        title: `Could not configure the Nx plugin for ${agentDisplayMap.codex}`,
        bodyLines: [
          `${codexConfigTomlPath(options.directory)} could not be parsed. Fix it and run "nx configure-ai-agents" again.`,
        ],
      });
    }
  }

  if (hasAgent('opencode')) {
    const version = pickAgentPluginVersion(
      latestPluginVersion,
      readOpencodePluginVersion(tree, options.directory)
    );
    if (version) {
      writeOpencodePlugin(tree, options.directory, version);
      removeLegacyFiles(legacyAgentFolders.opencode);
    } else {
      setupErrors.push(pluginVersionUnavailable('opencode'));
    }
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
  }

  // Codex and Cursor used to read Nx skills from the shared .agents folder.
  // Gemini still does, so the copies stay while Gemini is configured.
  if (
    (cursorConfigured || codexConfigured) &&
    !hasAgent('gemini') &&
    !hasGeminiNxMcp(tree, options.directory)
  ) {
    removeLegacyFiles(legacyAgentFolders.sharedSkills);
  }

  // Copilot and Gemini have no plugin to install, so they still get the Nx
  // skills, commands and subagents copied into the workspace.
  if (hasAgent('copilot') || hasAgent('gemini')) {
    let aiConfigRepoPath: string | undefined;
    try {
      aiConfigRepoPath = getAiConfigRepoPath();
    } catch {
      // Network/clone failure — the copied files are left as they are
    }
    if (aiConfigRepoPath) {
      const copies: { agent: Agent; src: string; dest: string }[] = [
        { agent: 'copilot', src: 'generated/.github', dest: '.github' },
        { agent: 'gemini', src: 'generated/.agents', dest: '.agents' },
        { agent: 'gemini', src: 'generated/.gemini', dest: '.gemini' },
      ];
      for (const { agent, src, dest } of copies) {
        const srcPath = join(aiConfigRepoPath, src);
        if (hasAgent(agent) && existsSync(srcPath)) {
          generateFiles(tree, srcPath, join(options.directory, dest), {});
        }
      }
    }
  }

  // Clean up legacy .gemini/skills that have been migrated to shared .agents/skills.
  // Only delete skills that exist in both locations to preserve user-created skills.
  if (hasAgent('gemini')) {
    const geminiSkillsDir = join(options.directory, '.gemini', 'skills');
    const sharedSkillsDir = join(options.directory, '.agents', 'skills');
    if (tree.exists(geminiSkillsDir) && tree.exists(sharedSkillsDir)) {
      const sharedSkills = new Set(tree.children(sharedSkillsDir));
      for (const skill of tree.children(geminiSkillsDir)) {
        if (sharedSkills.has(skill)) {
          tree.delete(join(geminiSkillsDir, skill));
        }
      }
    }
  }

  addEntryToGitIgnore(
    tree,
    join(options.directory, '.gitignore'),
    '.nx/polygraph'
  );

  addEntryToGitIgnore(
    tree,
    join(options.directory, '.gitignore'),
    '.claude/worktrees'
  );

  addEntryToGitIgnore(
    tree,
    join(options.directory, '.gitignore'),
    '.claude/settings.local.json'
  );

  await formatChangedFiles(tree);

  // we use the check variable to determine if we should actually make changes or just report what would be changed
  return async (check: boolean = false) => {
    const messages: CLINoteMessageConfig[] = [];
    const errors: CLIErrorMessageConfig[] = [...setupErrors];
    if (addedAnalyticsDomain) {
      messages.push({
        title: `Allowed ${analyticsDomain} through Claude Code's sandbox network filter`,
        bodyLines: [
          `Nx sends analytics there because this workspace sets "analytics": true in nx.json.`,
          `Set it to false to opt out, then remove the domain from .claude/settings.json.`,
        ],
      });
    }
    // Reported only when actually configuring: an edited file stays edited, so
    // it must not keep the agent flagged as outdated.
    if (!check && keptLegacyFiles.length > 0) {
      messages.push({
        title:
          'Kept files that Nx previously copied but that were edited since',
        bodyLines: [
          'The Nx agent plugins replace them. Delete them once your changes are no longer needed:',
          ...keptLegacyFiles.map((path) => `- ${path}`),
        ],
      });
    }
    if (codexConfigured && isCodexAvailable()) {
      if (check) {
        // Codex caches plugins per user, so a teammate who pulls the workspace
        // config still needs the one-time install.
        if (
          latestPluginVersion &&
          !isCodexPluginInstalled(latestPluginVersion)
        ) {
          messages.push({
            title: `The Nx plugin for ${agentDisplayMap.codex} is not installed for this user`,
          });
        }
      } else {
        const version = latestPluginVersion ?? 'latest';
        const result = installCodexPlugin(version, tree.root);
        if (result.ok) {
          messages.push({
            title: `Installed the Nx plugin for ${agentDisplayMap.codex}`,
            bodyLines: [
              `It is enabled only in workspaces that turn it on in ${codexConfigTomlPath('.')}.`,
            ],
          });
        } else {
          errors.push({
            title: `Failed to install the Nx plugin for ${agentDisplayMap.codex}. Please install it manually.`,
            bodyLines: [
              result.error,
              `Run: ${codexPluginInstallCommand(version)}`,
            ],
          });
        }
      }
    } else if (codexConfigured && !check) {
      messages.push({
        title: `Install the Nx plugin for ${agentDisplayMap.codex} once per machine`,
        bodyLines: [
          `The codex command was not found. After installing Codex, run: ${codexPluginInstallCommand(
            latestPluginVersion ?? 'latest'
          )}`,
        ],
      });
    }
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

/**
 * The user's existing entries in their original order, plus any of `values`
 * they do not already have. A Set does the deduping, so re-running the
 * generator is a no-op rather than a growing list.
 */
function withEntries(
  existing: string[] | undefined,
  ...values: readonly string[]
): string[] {
  return [...new Set([...(existing ?? []), ...values])];
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

export default setupAiAgentsGenerator;
