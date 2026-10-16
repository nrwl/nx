import { resolve } from 'path';
import { flushChanges, FsTree } from '../generators/tree';
import { isAiAgent, isEditorInstalled, SupportedEditor } from '../native';
import { isSandbox } from '../utils/is-sandbox';
import { output } from '../utils/output';
import {
  codexConfigTomlPath,
  cursorSettingsPath,
  geminiSettingsPath,
  opencodeMcpPath,
} from './constants';
import { hasAgentSetup } from './set-up-ai-agents/agent-plugin-config';
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
  /** Always empty; kept for older Nx versions that load this module. */
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
  const configured = hasAgentSetup(tree, '.', agent);
  let configPath: string | null = null;
  let disabled: boolean | undefined;
  switch (agent) {
    case 'claude':
      configPath = resolve(workspaceRoot, '.claude', 'settings.json');
      break;
    case 'cursor':
      configPath = cursorSettingsPath(workspaceRoot);
      disabled = !(await isEditorInstalled(SupportedEditor.Cursor));
      break;
    case 'codex':
      configPath = codexConfigTomlPath(workspaceRoot);
      break;
    case 'opencode':
      configPath = opencodeMcpPath(workspaceRoot);
      break;
    case 'copilot':
      disabled =
        !(await isEditorInstalled(SupportedEditor.VSCode)) &&
        !(await isEditorInstalled(SupportedEditor.VSCodeInsiders));
      break;
    case 'gemini':
      configPath = geminiSettingsPath(workspaceRoot);
      break;
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
