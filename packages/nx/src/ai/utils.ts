import {
  appendFileSync,
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from 'fs';
import { join, resolve } from 'path';
import {
  canInstallNxConsoleForEditor,
  installNxConsoleForEditor,
  SupportedEditor,
} from '../native';
import { flushChanges, FsTree } from '../generators/tree';
import setupAiAgentsGenerator from './set-up-ai-agents/set-up-ai-agents';
import { homedir } from 'os';
import { output } from '../utils/output';
import {
  claudeMcpPath,
  claudeMdPath,
  geminiMdPath,
  agentsMdPath,
  geminiSettingsPath,
  codexConfigTomlPath,
  parseGeminiSettings,
} from './config-paths';
import { getAgentRules } from './set-up-ai-agents/get-agent-rules';
import { isNxCloudUsed } from '../utils/nx-cloud-utils';
import { readNxJsonFromDisk } from '../devkit-internals';
import { readNxJson } from '../config/configuration';
import { readJsonFile } from '../utils/fileutils';

// when adding new agents, be sure to also update the list in
// packages/create-nx-workspace/src/internal-utils/prompts.ts
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
  mcpOutdated?: boolean;
  rulesOutdated?: boolean;
};

export async function getAgentConfiguration(
  agent: Agent,
  workspaceRoot: string
): Promise<AgentConfiguration> {
  let agentConfiguration: AgentConfiguration;
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
      const hasInstalledNxConsole =
        !canInstallNxConsoleForEditor(SupportedEditor.VSCode) &&
        !canInstallNxConsoleForEditor(SupportedEditor.VSCodeInsiders);
      const agentsMdExists = existsSync(rulesPath);

      agentConfiguration = {
        mcp: hasInstalledNxConsole,
        rules: agentsMdExists,
        rulesPath,
        mcpPath: null,
      };
      break;
    }
    case 'cursor': {
      const rulesPath = agentsMdPath(workspaceRoot);
      const hasInstalledNxConsole = !canInstallNxConsoleForEditor(
        SupportedEditor.Cursor
      );
      const agentsMdExists = existsSync(rulesPath);

      agentConfiguration = {
        mcp: hasInstalledNxConsole,
        rules: agentsMdExists,
        rulesPath,
        mcpPath: null,
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
    mcpOutdated: await getAgentMcpIsOutdated(
      agent,
      agentConfiguration,
      workspaceRoot
    ),
    rulesOutdated: getAgentRulesAreOutdated(
      agent,
      agentConfiguration,
      workspaceRoot
    ),
  };
}

function getAgentRulesAreOutdated(
  agent: Agent,
  agentConfiguration: AgentConfiguration,
  workspaceRoot: string
): boolean {
  // we check by seeing if the content in the rule files are what we would put in there right now
  const rulesPath = agentConfiguration.rulesPath;
  if (!existsSync(rulesPath)) {
    return true;
  }
  const existing = readFileSync(rulesPath, 'utf-8');
  const existingNxRules = existing.match(rulesRegex);

  if (!existingNxRules) {
    return true;
  }

  const expectedNxRules = getAgentRulesWrapped(
    isNxCloudUsed(readNxJsonFromDisk())
  );

  const contentOnly = (str: string) =>
    str
      .replace(nxRulesMarkerCommentStart, '')
      .replace(nxRulesMarkerCommentEnd, '')
      .replace(nxRulesMarkerCommentDescription, '')
      // we don't want to make updates on whitespace-only changes
      .replace(/\s/g, '');

  return contentOnly(existingNxRules[0]) !== contentOnly(expectedNxRules);
}

async function getAgentMcpIsOutdated(
  agent: Agent,
  agentConfiguration: AgentConfiguration,
  workspaceRoot: string
): Promise<boolean> {
  // no mcp path -> installation through editor, treat as not outdated
  if (!agentConfiguration.mcpPath) {
    return false;
  }

  // claude and gemini are configured fully locally so we can just run the generator
  if (agent === 'claude' || agent === 'gemini') {
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

export async function getAgentConfigurations(
  agentsToConsider: Agent[],
  workspaceRoot: string
): Promise<{
  nonConfiguredAgents: Agent[];
  partiallyConfiguredAgents: Agent[];
  fullyConfiguredAgents: Agent[];
  agentConfigurations: Map<Agent, AgentConfiguration>;
}> {
  const nonConfiguredAgents: Agent[] = [];
  const partiallyConfiguredAgents: Agent[] = [];
  const fullyConfiguredAgents: Agent[] = [];
  const agentConfigurations = new Map<Agent, AgentConfiguration>();

  for (const agent of agentsToConsider) {
    const configured = await getAgentConfiguration(agent, workspaceRoot);
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
    agentConfigurations,
  };
}

export const nxRulesMarkerCommentStart = `<!-- nx configuration start-->`;
export const nxRulesMarkerCommentDescription = `<!-- Leave the start & end comments to automatically receive updates. -->`;
export const nxRulesMarkerCommentEnd = `<!-- nx configuration end-->`;
export const rulesRegex = new RegExp(
  `${nxRulesMarkerCommentStart}[\\s\\S]*?${nxRulesMarkerCommentEnd}`,
  'm'
);

export const getAgentRulesWrapped = (writeNxCloudRules: boolean) => {
  const agentRulesString = getAgentRules(writeNxCloudRules);
  return `${nxRulesMarkerCommentStart}\n${nxRulesMarkerCommentDescription}\n${agentRulesString}\n${nxRulesMarkerCommentEnd}`;
};

export const nxMcpTomlHeader = `[mcp_servers."nx-mcp"]`;
export const nxMcpTomlConfig = `${nxMcpTomlHeader}
type = "stdio"
command = "npx"
args = ["nx", "mcp"]
`;
