import { resolve } from 'path';
import { flushChanges, FsTree } from '../generators/tree';
import { isAiAgent, isEditorInstalled, SupportedEditor } from '../native';
import { isSandbox } from '../utils/is-sandbox';
import { output } from '../utils/output';
import {
  claudeMdPath,
  codexConfigTomlPath,
  cursorSettingsPath,
  geminiSettingsPath,
  opencodeMcpPath,
} from './constants';
import {
  hasCodexNxMcp,
  hasCodexPlugin,
  hasCursorPlugin,
  hasGeminiNxMcp,
  hasOpencodeNxMcp,
  hasOpencodePlugin,
  isClaudePluginEnabled,
} from './set-up-ai-agents/agent-plugin-config';
import {
  findLegacyAgentFiles,
  hasNxRulesBlock,
  legacyAgentFolders,
} from './set-up-ai-agents/legacy-agent-config';
import setupAiAgentsGenerator from './set-up-ai-agents/set-up-ai-agents';

// when adding new agents, be sure to also update the list in
// packages/create-nx-workspace/src/create-workspace-options.ts
export const supportedAgents = [
  'claude',
  'codex',
  'copilot',
  'cursor',
  'gemini',
  'opencode',
] as const;
export type Agent = (typeof supportedAgents)[number];
export const agentDisplayMap: Record<Agent, string> = {
  claude: 'Claude Code',
  gemini: 'Gemini',
  codex: 'OpenAI Codex',
  copilot: 'GitHub Copilot for VSCode',
  cursor: 'Cursor',
  opencode: 'OpenCode',
};

export type AgentConfiguration = {
  name: Agent;
  displayName: string;
  /**
   * Whether the workspace has an Nx setup for this agent: the Nx plugin, or a
   * file-based setup from an older version of `nx configure-ai-agents` that
   * still needs to be migrated.
   */
  configured: boolean;
  /** The file holding the agent's Nx setup, when there is one. */
  configPath: string | null;
  outdated: boolean;
  disabled?: boolean;
};

export async function getAgentConfigurations(
  agentsToConsider: Agent[],
  workspaceRoot: string
): Promise<{
  nonConfiguredAgents: AgentConfiguration[];
  /**
   * Always empty: an agent's Nx setup is a single plugin registration, so it
   * is either configured or not. Kept for callers from older Nx versions that
   * load this module from the latest Nx.
   */
  partiallyConfiguredAgents: AgentConfiguration[];
  fullyConfiguredAgents: AgentConfiguration[];
  disabledAgents: AgentConfiguration[];
}> {
  const nonConfiguredAgents: AgentConfiguration[] = [];
  const fullyConfiguredAgents: AgentConfiguration[] = [];
  const disabledAgents: AgentConfiguration[] = [];

  for (const agent of agentsToConsider) {
    const configuration = await getAgentConfiguration(agent, workspaceRoot);
    if (configuration.disabled) {
      disabledAgents.push(configuration);
    } else if (configuration.configured) {
      fullyConfiguredAgents.push(configuration);
    } else {
      nonConfiguredAgents.push(configuration);
    }
  }

  return {
    nonConfiguredAgents,
    partiallyConfiguredAgents: [],
    fullyConfiguredAgents,
    disabledAgents,
  };
}

async function getAgentConfiguration(
  agent: Agent,
  workspaceRoot: string
): Promise<AgentConfiguration> {
  const tree = new FsTree(workspaceRoot, false);
  let configured: boolean;
  let configPath: string | null;
  let disabled: boolean | undefined;
  switch (agent) {
    case 'claude': {
      configPath = resolve(workspaceRoot, '.claude', 'settings.json');
      configured =
        isClaudePluginEnabled(tree, '.') ||
        hasNxRulesBlock(tree, claudeMdPath('.'));
      break;
    }
    case 'cursor': {
      configPath = cursorSettingsPath(workspaceRoot);
      configured =
        hasCursorPlugin(tree, '.') ||
        findLegacyAgentFiles(tree, '.', legacyAgentFolders.cursor).length > 0;
      disabled = !(await isEditorInstalled(SupportedEditor.Cursor));
      break;
    }
    case 'codex': {
      configPath = codexConfigTomlPath(workspaceRoot);
      configured =
        hasCodexPlugin(tree, '.') ||
        hasCodexNxMcp(tree, '.') ||
        findLegacyAgentFiles(tree, '.', legacyAgentFolders.codex).length > 0;
      break;
    }
    case 'opencode': {
      configPath = opencodeMcpPath(workspaceRoot);
      configured =
        hasOpencodePlugin(tree, '.') ||
        hasOpencodeNxMcp(tree, '.') ||
        findLegacyAgentFiles(tree, '.', legacyAgentFolders.opencode).length > 0;
      break;
    }
    case 'copilot': {
      // Copilot has no plugin; Nx copies its skills and subagents instead.
      configPath = null;
      configured =
        findLegacyAgentFiles(tree, '.', legacyAgentFolders.copilot).length > 0;
      const hasInstalledVSCode = await isEditorInstalled(
        SupportedEditor.VSCode
      );
      const hasInstalledVSCodeInsiders = await isEditorInstalled(
        SupportedEditor.VSCodeInsiders
      );
      disabled = !hasInstalledVSCode && !hasInstalledVSCodeInsiders;
      break;
    }
    case 'gemini': {
      configPath = geminiSettingsPath(workspaceRoot);
      configured = hasGeminiNxMcp(tree, '.');
      break;
    }
  }

  return {
    configured,
    configPath,
    ...(disabled === undefined ? {} : { disabled }),
    outdated:
      configured && (await agentWouldChangeWithGenerator(agent, workspaceRoot)),
    name: agent,
    displayName: agentDisplayMap[agent],
  };
}

async function agentWouldChangeWithGenerator(
  agent: Agent,
  workspaceRoot: string
): Promise<boolean> {
  const tree = new FsTree(workspaceRoot, false);
  const callback = await setupAiAgentsGenerator(
    tree,
    {
      directory: '.',
      agents: [agent],
    },
    true
  );
  const modificationResults = await callback(true);
  return (
    tree.listChanges().length > 0 || modificationResults.messages.length > 0
  );
}

export async function configureAgents(
  agents: Agent[],
  workspaceRoot: string,
  useLatest?: boolean
): Promise<void> {
  const tree = new FsTree(workspaceRoot, false);
  const callback = await setupAiAgentsGenerator(
    tree,
    {
      directory: '.',
      agents,
    },
    !useLatest
  );

  // changes that are out of scope for the generator itself because they do more than modify the tree
  flushChanges(workspaceRoot, tree.listChanges());

  const modificationResults = await callback();

  modificationResults.messages.forEach((message) => output.log(message));
  modificationResults.errors.forEach((error) => output.error(error));
}

/**
 * Explains a permission error thrown while writing agent configuration files.
 *
 * The errno alone does not identify the cause. Agent harnesses (e.g. Claude
 * Code) deny writes to their own settings files from sandboxed shell commands,
 * so `nx configure-ai-agents` run through an agent's bash tool fails with EPERM
 * where the same command succeeds in a terminal — but a root-owned
 * `.claude/settings.json` left by an earlier `sudo nx`, or a read-only
 * checkout, produces the same errno with an unrelated remedy. The sandbox
 * explanation is therefore only offered where a sandbox or an agent is
 * actually detected, and the underlying message is kept either way.
 */
export function agentConfigWriteBlockedLines(error: unknown): string[] {
  const err = error as NodeJS.ErrnoException | undefined;
  const target = err?.path ?? 'an agent configuration file';
  return [
    `Writing ${target} failed: ${err?.message ?? 'permission denied'}`,
    ...(isSandbox() || isAiAgent()
      ? [
          "Agent sandboxes protect their own settings files from writes made by sandboxed shell commands, so this command cannot finish when run through an agent's bash tool.",
          'To complete the AI agent setup, run `nx configure-ai-agents` from a regular terminal and relaunch the agent harness.',
        ]
      : [
          'Check the ownership and mode of that path: an earlier `sudo nx` run or a read-only checkout produces this.',
        ]),
  ];
}
