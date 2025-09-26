import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { readNxJson } from '../config/configuration';
import { flushChanges, FsTree } from '../generators/tree';
import {
  canInstallNxConsoleForEditor,
  isEditorInstalled,
  SupportedEditor,
} from '../native';
import { readJsonFile } from '../utils/fileutils';
import { isNxCloudUsed } from '../utils/nx-cloud-utils';
import { output } from '../utils/output';
import {
  agentsMdPath,
  claudeMcpPath,
  claudeMdPath,
  codexConfigTomlPath,
  geminiMdPath,
  geminiSettingsPath,
  nxMcpTomlHeader,
  parseGeminiSettings,
} from './constants';
import setupAiAgentsGenerator from './set-up-ai-agents/set-up-ai-agents';

// when adding new agents, be sure to also update the list in
// packages/create-nx-workspace/src/create-workspace-options.ts
export const supportedAgents = [
  'claude',
  'codex',
  'copilot',
  'cursor',
  'gemini',
] as const;
export type Agent = (typeof supportedAgents)[number];
export const agentDisplayMap: Record<Agent, string> = {
  claude: 'Claude Code',
  gemini: 'Gemini',
  codex: 'OpenAI Codex',
  copilot: 'GitHub Copilot for VSCode',
  cursor: 'Cursor',
};

export type AgentConfiguration = {
  rules: boolean;
  mcp: boolean;
  rulesPath: string;
  mcpPath: string | null;
  outdated: boolean;
  disabled?: boolean;
};

export async function getAgentConfigurations(
  agentsToConsider: Agent[],
  workspaceRoot: string
): Promise<{
  nonConfiguredAgents: Agent[];
  partiallyConfiguredAgents: Agent[];
  fullyConfiguredAgents: Agent[];
  disabledAgents: Agent[];
  agentConfigurations: Map<Agent, AgentConfiguration>;
}> {
  const nonConfiguredAgents: Agent[] = [];
  const partiallyConfiguredAgents: Agent[] = [];
  const fullyConfiguredAgents: Agent[] = [];
  const disabledAgents: Agent[] = [];
  const agentConfigurations = new Map<Agent, AgentConfiguration>();

  for (const agent of agentsToConsider) {
    const configured = await getAgentConfiguration(agent, workspaceRoot);
    if (configured.disabled) {
      disabledAgents.push(agent);
      continue;
    }
    agentConfigurations.set(agent, configured);
    if (configured.mcp && configured.rules) {
      fullyConfiguredAgents.push(agent);
    } else if (!configured.mcp && !configured.rules) {
      nonConfiguredAgents.push(agent);
    } else {
      partiallyConfiguredAgents.push(agent);
    }
  }

  return {
    nonConfiguredAgents,
    partiallyConfiguredAgents,
    fullyConfiguredAgents,
    disabledAgents,
    agentConfigurations,
  };
}

async function getAgentConfiguration(
  agent: Agent,
  workspaceRoot: string
): Promise<AgentConfiguration> {
  let agentConfiguration: Omit<AgentConfiguration, 'outdated'>;
  switch (agent) {
    case 'claude': {
      const mcpPath = claudeMcpPath(workspaceRoot);
      let mcpConfigured: boolean;
      try {
        const mcpContents = readJsonFile(mcpPath);
        mcpConfigured = !!mcpContents?.['mcpServers']?.['nx-mcp'];
      } catch {
        mcpConfigured = false;
      }
      const rulesPath = claudeMdPath(workspaceRoot);
      const rulesExists = existsSync(rulesPath);
      agentConfiguration = {
        rules: rulesExists,
        mcp: mcpConfigured,
        rulesPath: rulesPath,
        mcpPath: mcpPath,
      };
      break;
    }
    case 'gemini': {
      const geminiRulePath = geminiMdPath(workspaceRoot);
      const geminiMdExists = existsSync(geminiRulePath);
      const settingsPath = geminiSettingsPath(workspaceRoot);

      let mcpConfigured: boolean;

      const geminiSettings = parseGeminiSettings(workspaceRoot);
      const customContextFilePath: string | undefined =
        geminiSettings?.contextFileName;
      const customContextFilePathExists = customContextFilePath
        ? existsSync(resolve(workspaceRoot, customContextFilePath))
        : false;
      mcpConfigured = geminiSettings?.['mcpServers']?.['nx-mcp'];

      agentConfiguration = {
        rules:
          (!customContextFilePath && geminiMdExists) ||
          (customContextFilePath && customContextFilePathExists),
        mcp: mcpConfigured,
        rulesPath: customContextFilePath ?? geminiRulePath,
        mcpPath: settingsPath,
      };
      break;
    }
    case 'copilot': {
      const rulesPath = agentsMdPath(workspaceRoot);
      const hasInstalledVSCode = isEditorInstalled(SupportedEditor.VSCode);
      const hasInstalledVSCodeInsiders = isEditorInstalled(
        SupportedEditor.VSCodeInsiders
      );
      const hasInstalledNxConsoleForVSCode =
        hasInstalledVSCode &&
        !canInstallNxConsoleForEditor(SupportedEditor.VSCode);
      const hasInstalledNxConsoleForVSCodeInsiders =
        hasInstalledVSCodeInsiders &&
        !canInstallNxConsoleForEditor(SupportedEditor.VSCodeInsiders);

      const agentsMdExists = existsSync(rulesPath);

      agentConfiguration = {
        mcp:
          hasInstalledNxConsoleForVSCode ||
          hasInstalledNxConsoleForVSCodeInsiders,
        rules: agentsMdExists,
        rulesPath,
        mcpPath: null,
        disabled: !hasInstalledVSCode && !hasInstalledVSCodeInsiders,
      };
      break;
    }
    case 'cursor': {
      const rulesPath = agentsMdPath(workspaceRoot);
      const hasInstalledCursor = isEditorInstalled(SupportedEditor.Cursor);
      const hasInstalledNxConsole = !canInstallNxConsoleForEditor(
        SupportedEditor.Cursor
      );
      const agentsMdExists = existsSync(rulesPath);

      agentConfiguration = {
        mcp: hasInstalledCursor ? hasInstalledNxConsole : false,
        rules: agentsMdExists,
        rulesPath,
        mcpPath: null,
        disabled: !hasInstalledCursor,
      };
      break;
    }
    case 'codex': {
      const rulesPath = agentsMdPath(workspaceRoot);
      const agentsMdExists = existsSync(rulesPath);
      let mcpConfigured: boolean;
      if (existsSync(codexConfigTomlPath)) {
        const tomlContents = readFileSync(codexConfigTomlPath, 'utf-8');
        mcpConfigured = tomlContents.includes(nxMcpTomlHeader);
      } else {
        mcpConfigured = false;
      }

      agentConfiguration = {
        mcp: mcpConfigured,
        rules: agentsMdExists,
        rulesPath,
        mcpPath: codexConfigTomlPath,
      };
      break;
    }
  }

  return {
    ...agentConfiguration,
    outdated: await isAgentOutdated(agent, workspaceRoot),
  };
}

async function isAgentOutdated(
  agent: Agent,
  workspaceRoot: string
): Promise<boolean> {
  const tree = new FsTree(workspaceRoot, false);
  const callback = await setupAiAgentsGenerator(
    tree,
    {
      directory: '.',
      agents: [agent],
      writeNxCloudRules: isNxCloudUsed(readNxJson()),
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
  const writeNxCloudRules = isNxCloudUsed(readNxJson());
  const tree = new FsTree(workspaceRoot, false);
  const callback = await setupAiAgentsGenerator(
    tree,
    {
      directory: '.',
      agents,
      writeNxCloudRules,
    },
    !useLatest
  );

  // changes that are out of scope for the generator itself because they do more than modify the tree
  flushChanges(workspaceRoot, tree.listChanges());

  const modificationResults = await callback();

  modificationResults.messages.forEach((message) => output.log(message));
  modificationResults.errors.forEach((error) => output.error(error));
}
