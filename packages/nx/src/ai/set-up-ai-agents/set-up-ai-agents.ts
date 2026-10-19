import { join } from 'path';
import { formatChangedFiles } from '../../generators/internal-utils/format-changed-files';
import { Tree } from '../../generators/tree';
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
import {
  agentPluginsDistTag,
  agentPluginsRepo,
  analyticsDomain,
  NX_ALLOWLIST_ROOTS,
  claudeMcpJsonPath,
  claudePluginId,
  codexConfigTomlPath,
} from '../constants';
import { Agent, agentDisplayMap, supportedAgents } from '../utils';
import { getLatestAgentPluginVersion } from './agent-plugin-version';
import {
  agentPluginsGitRefFor,
  readCodexConfig,
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
  removeLegacyNxSetup,
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
    // Callers from older Nx versions may still pass agents nx no longer supports
    agents: (options.agents ?? [...supportedAgents]).filter((agent) =>
      supportedAgents.includes(agent)
    ),
  };
}

export async function setupAiAgentsGeneratorImpl(
  tree: Tree,
  options: NormalizedSetupAiAgentsGeneratorSchema
): Promise<(check?: boolean) => Promise<ModificationResults>> {
  const hasAgent = (agent: Agent) => options.agents.includes(agent);
  const analyticsEnabled = isAnalyticsEnabled(readNxJson(tree));
  let addedAnalyticsDomain = false;
  // Problems that keep an agent from being configured. They are reported, but
  // unlike messages they don't mark the agent as outdated.
  const setupErrors: CLIErrorMessageConfig[] = [];
  // Rules-file blocks and the Copilot and Gemini setups go on every run,
  // whichever agents are selected.
  const keptLegacyFiles = [
    ...removeLegacyNxSetup(tree, options.directory).kept,
  ];
  let codexConfigured = false;

  // Claude Code, Cursor and OpenCode follow the channel's releases on their
  // own. Codex installs a fixed version per user, so it is compared against
  // the channel's latest release.
  const latestPluginVersion = hasAgent('codex')
    ? await getLatestAgentPluginVersion()
    : null;
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
          ...json.extraKnownMarketplaces?.['nx-claude-plugins'],
          source: {
            ...json.extraKnownMarketplaces?.['nx-claude-plugins']?.source,
            source: 'github',
            repo: agentPluginsRepo,
            ref: agentPluginsGitRefFor(
              json.extraKnownMarketplaces?.['nx-claude-plugins']?.source?.ref
            ),
          },
          // Claude Code only refreshes third-party marketplaces that opt in,
          // so without this users would stay on the version they installed.
          autoUpdate:
            json.extraKnownMarketplaces?.['nx-claude-plugins']?.autoUpdate ??
            true,
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

  if (hasAgent('cursor')) {
    writeCursorPlugin(tree, options.directory);
    removeLegacyFiles(legacyAgentFolders.cursor);
  }

  if (hasAgent('codex')) {
    if (readCodexConfig(tree, options.directory)) {
      // Copied subagent files go first so their config entries can go with them.
      removeLegacyFiles(legacyAgentFolders.codex);
      writeCodexPlugin(tree, options.directory);
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
    writeOpencodePlugin(tree, options.directory);
    removeLegacyFiles(legacyAgentFolders.opencode);
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
      } else if (
        !latestPluginVersion ||
        !isCodexPluginInstalled(latestPluginVersion)
      ) {
        const version = latestPluginVersion ?? agentPluginsDistTag;
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
            latestPluginVersion ?? agentPluginsDistTag
          )}`,
        ],
      });
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

export default setupAiAgentsGenerator;
