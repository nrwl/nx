import {
  appendFileSync,
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from 'fs';
import { join } from 'path';
import { canInstallNxConsoleForEditor } from '../native';
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
} from './config-paths';

export const availableAgents = [
  'claude',
  'codex',
  'copilot',
  'cursor',
  'gemini',
] as const;
export type Agent = (typeof availableAgents)[number];

export function getAgentIsConfigured(
  agent: Agent,
  workspaceRoot: string
): {
  rules: boolean;
  mcp: boolean;
} {
  switch (agent) {
    case 'claude': {
      const mcpPath = claudeMcpPath(workspaceRoot);
      let mcpConfigured: boolean;
      try {
        const mcpContents = JSON.parse(readFileSync(mcpPath, 'utf-8'));
        mcpConfigured = !!mcpContents['mcpServers']['nx-mcp'];
      } catch {
        mcpConfigured = false;
      }
      return {
        rules: existsSync(claudeMdPath(workspaceRoot)),
        mcp: mcpConfigured,
      };
    }
    case 'gemini': {
      const geminiMdExists = existsSync(geminiMdPath(workspaceRoot));
      const agentsMdExists = existsSync(agentsMdPath(workspaceRoot));
      let mcpConfigured: boolean;
      let pointsToAgentsMd: boolean;
      try {
        const geminiSettings = JSON.parse(
          readFileSync(geminiSettingsPath(workspaceRoot), 'utf-8')
        );
        pointsToAgentsMd = geminiSettings.contextFileName === 'AGENTS.md';
        mcpConfigured = geminiSettings?.['mcpServers']?.['nx-mcp'];
      } catch {
        mcpConfigured = false;
        pointsToAgentsMd = false;
      }

      return {
        mcp: mcpConfigured,
        rules: geminiMdExists || (pointsToAgentsMd && agentsMdExists),
      };
    }
    case 'copilot': {
      const hasInstalledNxConsole =
        !canInstallNxConsoleForEditor('vscode') &&
        !canInstallNxConsoleForEditor('vscode-insiders');
      const agentsMdExists = existsSync(agentsMdPath(workspaceRoot));

      return {
        mcp: hasInstalledNxConsole,
        rules: agentsMdExists,
      };
    }
    case 'cursor': {
      const hasInstalledNxConsole = !canInstallNxConsoleForEditor('cursor');
      const agentsMdExists = existsSync(agentsMdPath(workspaceRoot));

      return {
        mcp: hasInstalledNxConsole,
        rules: agentsMdExists,
      };
    }
    case 'codex': {
      const agentsMdExists = existsSync(agentsMdPath(workspaceRoot));
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
      };
    }
    default: {
      return {
        rules: false,
        mcp: false,
      };
    }
  }
}

export async function getAgentConfigurationIsOutdated(
  agent: Agent,
  workspaceRoot: string
): Promise<boolean> {
  // we check by
  return false;
}

export async function configureAgents(
  agents: Agent[],
  workspaceRoot: string,
  useLatest?: boolean
): Promise<void> {
  const tree = new FsTree(workspaceRoot, false);
  await setupAiAgentsGenerator(
    tree,
    {
      directory: '.',
      agents: agents,
    },
    !useLatest
  );

  flushChanges(workspaceRoot, tree.listChanges());

  // changes that are out of scope for the generator because they do more than modify the tree
  if (agents.includes('codex')) {
    if (existsSync(codexConfigTomlPath)) {
      const tomlContents = readFileSync(codexConfigTomlPath, 'utf-8');
      if (!tomlContents.includes(nxMcpTomlHeader)) {
        appendFileSync(codexConfigTomlPath, `\n${nxMcpTomlConfig}`);
        output.log({
          title: `Updated ${codexConfigTomlPath} with nx-mcp server`,
        });
      }
    } else {
      mkdirSync(join(homedir(), '.codex'), { recursive: true });
      writeFileSync(codexConfigTomlPath, nxMcpTomlConfig);
      output.log({
        title: `Created ${codexConfigTomlPath} with nx-mcp server`,
      });
    }
  }
  if (agents.includes('copilot')) {
    // install nx console if not installed
  }
  if (agents.includes('cursor')) {
    // install nx console if not installed
  }
}

export function getAgentConfigurations(
  agentsToConsider: Agent[],
  workspaceRoot: string
): {
  nonConfiguredAgents: Agent[];
  partiallyConfiguredAgents: Agent[];
  fullyConfiguredAgents: Agent[];
} {
  const nonConfiguredAgents: Agent[] = [];
  const partiallyConfiguredAgents: Agent[] = [];
  const fullyConfiguredAgents: Agent[] = [];

  agentsToConsider.forEach((agent) => {
    const configured = getAgentIsConfigured(agent, workspaceRoot);
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
  };
}

export const nxRulesMarkerCommentStart = `// nx configuration start`;
export const nxRulesMarkerCommentDescription = `Leave the start & end comments to automatically receive updates.`;
export const nxRulesMarkerCommentEnd = `// nx configuration end`;

const nxMcpTomlHeader = `[mcp_servers."nx-mcp"]`;
const nxMcpTomlConfig = `${nxMcpTomlHeader}
type = "stdio"
command = "npx"
args = ["nx", "mcp"]
`;
