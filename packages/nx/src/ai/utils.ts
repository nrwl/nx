import {
  appendFileSync,
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from 'fs';
import { join } from 'path';
import {
  canInstallNxConsoleForEditor,
  installNxConsoleForEditor,
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

// when adding new agents, be sure to also update the list in
// packages/create-nx-workspace/src/internal-utils/prompts.ts
export const availableAgents = [
  'claude',
  'codex',
  'copilot',
  'cursor',
  'gemini',
] as const;
export type Agent = (typeof availableAgents)[number];

export type AgentConfiguration = {
  rules: boolean;
  mcp: boolean;
  rulesPath: string;
  mcpPath: string | null;
};

export function getAgentConfiguration(
  agent: Agent,
  workspaceRoot: string
): {
  rules: boolean;
  rulesPath: string;
  mcp: boolean;
  mcpPath: string | null;
} {
  switch (agent) {
    case 'claude': {
      const mcpPath = claudeMcpPath(workspaceRoot);
      let mcpConfigured: boolean;
      try {
        const mcpContents = JSON.parse(readFileSync(mcpPath, 'utf-8'));
        mcpConfigured = !!mcpContents?.['mcpServers']?.['nx-mcp'];
      } catch {
        mcpConfigured = false;
      }
      const rulesPath = claudeMdPath(workspaceRoot);
      const rulesExists = existsSync(rulesPath);
      return {
        rules: rulesExists,
        mcp: mcpConfigured,
        rulesPath: rulesPath,
        mcpPath: mcpPath,
      };
    }
    case 'gemini': {
      const geminiRulePath = geminiMdPath(workspaceRoot);
      const agentsRulePath = agentsMdPath(workspaceRoot);
      const geminiMdExists = existsSync(geminiRulePath);
      const agentsMdExists = existsSync(agentsRulePath);
      const settingsPath = geminiSettingsPath(workspaceRoot);

      let mcpConfigured: boolean;
      let pointsToAgentsMd: boolean;
      const geminiSettings = parseGeminiSettings(workspaceRoot);
      pointsToAgentsMd = geminiSettings?.contextFileName === 'AGENTS.md';
      mcpConfigured = geminiSettings?.['mcpServers']?.['nx-mcp'];

      return {
        rules: geminiMdExists || (pointsToAgentsMd && agentsMdExists),
        mcp: mcpConfigured,
        rulesPath: pointsToAgentsMd ? agentsRulePath : geminiRulePath,
        mcpPath: settingsPath,
      };
    }
    case 'copilot': {
      const rulesPath = agentsMdPath(workspaceRoot);
      const hasInstalledNxConsole =
        !canInstallNxConsoleForEditor('vscode') &&
        !canInstallNxConsoleForEditor('vscode-insiders');
      const agentsMdExists = existsSync(rulesPath);

      return {
        mcp: hasInstalledNxConsole,
        rules: agentsMdExists,
        rulesPath,
        mcpPath: null,
      };
    }
    case 'cursor': {
      const rulesPath = agentsMdPath(workspaceRoot);
      const hasInstalledNxConsole = !canInstallNxConsoleForEditor('cursor');
      const agentsMdExists = existsSync(rulesPath);

      return {
        mcp: hasInstalledNxConsole,
        rules: agentsMdExists,
        rulesPath,
        mcpPath: null,
      };
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

      return {
        mcp: mcpConfigured,
        rules: agentsMdExists,
        rulesPath,
        mcpPath: codexConfigTomlPath,
      };
    }
  }
}

export async function getAgentConfigurationIsOutdated(
  agent: Agent,
  agentConfiguration: AgentConfiguration,
  workspaceRoot: string
): Promise<{
  mcpOutdated: boolean;
  rulesOutdated: boolean;
}> {
  const rulesOutdated = getAgentRulesAreOutdated(
    agent,
    agentConfiguration,
    workspaceRoot
  );

  const mcpOutdated = await getAgentMcpIsOutdated(
    agent,
    agentConfiguration,
    workspaceRoot
  );

  return {
    mcpOutdated,
    rulesOutdated,
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

  if (contentOnly(existingNxRules[0]) !== contentOnly(expectedNxRules)) {
    return true;
  }

  return false;
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
    await setupAiAgentsGenerator(
      tree,
      {
        directory: '.',
        agents: [agent],
        writeNxCloudRules: isNxCloudUsed(readNxJson()),
      },
      true
    );
    return tree.listChanges().length > 0;
  }

  // codex is the one special case for now where we have to check the toml file
  if (agent === 'codex') {
    const mcpFile = agentConfiguration.mcpPath;

    if (!existsSync(mcpFile)) {
      return true;
    }

    const tomlContents = readFileSync(mcpFile, 'utf-8');

    return tomlContents.includes(nxMcpTomlHeader) === false;
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
      agents: agents,
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

export function getAgentConfigurations(
  agentsToConsider: Agent[],
  workspaceRoot: string
): {
  nonConfiguredAgents: Agent[];
  partiallyConfiguredAgents: Agent[];
  fullyConfiguredAgents: Agent[];
  agentConfigurations: Map<Agent, AgentConfiguration>;
} {
  const nonConfiguredAgents: Agent[] = [];
  const partiallyConfiguredAgents: Agent[] = [];
  const fullyConfiguredAgents: Agent[] = [];
  const agentConfigurations = new Map<Agent, AgentConfiguration>();

  agentsToConsider.forEach((agent) => {
    const configured = getAgentConfiguration(agent, workspaceRoot);
    agentConfigurations.set(agent, configured);
    if (configured.mcp && configured.rules) {
      fullyConfiguredAgents.push(agent);
    } else if (!configured.mcp && !configured.rules) {
      nonConfiguredAgents.push(agent);
    } else {
      partiallyConfiguredAgents.push(agent);
    }
  });

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
